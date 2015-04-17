var debug = require('debug')('webcat')
var ghsign = require('ghsign')
var signalhub = require('signalhub')
var SimplePeer = require('simple-peer')
var fs = require('fs')
var path = require('path')
var duplexify = require('duplexify')
var through = require('through2')
var pump = require('pump')

var noop = function () {}

var conf = {}
try {
  conf = JSON.parse(fs.readFileSync(path.join(process.env.HOME || process.env.USERPROFILE, '.config/webcat.json')))
} catch (err) {
  // do nothing
}

module.exports = function (username, opts) {
  if (!opts) opts = {}
  if (!opts.username) opts.username = conf.username
  if (!opts.username) throw new Error('You must specify options.username or run webcat --configure')

  debug('new instance', username, opts)

  var stream = duplexify()

  var hub = signalhub(opts.signalhub || 'http://dev.mathiasbuus.eu:8080')
  var sign = ghsign.signer(opts.username)
  var verify = ghsign.verifier(username)

  var signMessage = function (message, cb) {
    debug('signing message', message)
    message = JSON.stringify(message)
    sign(message, 'base64', function (err, sig) {
      if (err) return cb(err)
      cb(null, [sig, message])
    })
  }

  var verifyMessage = function (data, cb) {
    if (!Array.isArray(data) || data.length !== 2) return cb()
    debug('verifying message', data)
    verify(data[1], data[0], 'base64', function (err, verified) {
      debug('message verified?', err, verified)
      if (err) return cb(err)
      if (verified) return cb(null, JSON.parse(data[1]))
      cb()
    })
  }

  var peer = null
  var subs = hub.subscribe(opts.username)
  var syn = {type: 'syn', nouce: Math.random()}
  var isInitiator = false
  var connected = false

  var sendSyn = function (cb) {
    if (!cb) cb = noop
    signMessage(syn, function (err, message) {
      if (err) return cb(err)
      debug('sendSyn', message)
      hub.broadcast(username, message, cb)
    })
  }

  var createPeer = function (initiator) {
    if (peer) return

    isInitiator = initiator
    peer = new SimplePeer({initiator: initiator, trickle: false})

    peer.on('connect', function () {
      connected = true
      subs.destroy()
      debug('connected')
      stream.emit('connect')
      stream.setReadable(peer)
      stream.setWritable(peer)
    })

    peer.on('close', function () {
      stream.destroy()
    })

    peer.on('signal', function (signal) {
      debug('local signal', signal)
      stream.emit('signal', signal)

      signMessage(signal, function (err, message) {
        if (err) return stream.destroy(err)
        hub.broadcast(username, message, function (err) {
          if (err) stream.destroy(err)
        })
      })
    })
  }

  pump(subs, through.obj(function (data, enc, cb) {
    debug('received message', data)
    verifyMessage(data, function (err, message) {
      if (err) return cb(err)
      if (!message) return cb()

      if (message.type === 'syn' && peer) return cb()

      if (message.type === 'syn') {
        if (message.nouce === syn.nouce) return cb()
        if (message.nouce < syn.nouce) return sendSyn(cb)
        createPeer(true)
        return cb()
      }

      if (isInitiator && message.type === 'offer') return cb()
      if (!isInitiator && message.type === 'answer') return cb()

      if (message.type === 'offer' || message.type === 'answer') {
        debug('remote signal', message)
        stream.emit('receive-signal', data)
        createPeer(false)
        peer.signal(message)
        return cb()
      }

      cb() // accept everything else
    })
  }), function (err) {
    debug('after pipe', err)
    if (!connected) stream.destroy(err)
  })

  sendSyn(function (err) {
    if (err) return stream.destroy(err)
  })

  return stream
}
