var debug = require('debug')('webcat')
var ghsign = require('ghsign')
var signalhub = require('signalhub')
var SimplePeer = require('simple-peer')
var fs = require('fs')
var path = require('path')
var duplexify = require('duplexify')

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
  if (opts.initiator === undefined) opts.initiator = username < opts.username

  debug('new instance', username, opts)

  var sign = ghsign.signer(opts.username)
  var verify = ghsign.verifier(username)
  var stream = duplexify()

  var peer = new SimplePeer({initiator: opts.initiator, trickle: false})
  var hub = signalhub(opts.signalhub || 'http://dev.mathiasbuus.eu:8080')

  var subs = hub.subscribe(opts.username)

  subs.on('data', function ondata (data) {
    debug('subscription', data)

    if (data.from !== username) return
    if (!data.signal && !data.signal.type || !data.signal.sdp || !data.signature) return
    if (opts.initiator && data.signal.type === 'offer') return
    if (!opts.initiator && data.signal.type !== 'offer') return

    subs.removeListener('data', ondata)
    subs.destroy()

    stream.emit('receive-signal', data)

    debug('verifying message')
    verify(data.signal.type + '\n' + data.signal.sdp, data.signature, 'base64', function (err, verified) {
      debug('verified message?', err, verified)
      if (err) return stream.destroy(err)
      if (!verified) return
      peer.signal(data.signal)
    })
  })

  peer.on('connect', function () {
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
    sign(signal.type + '\n' + signal.sdp, 'base64', function (err, sig) {
      if (err) return stream.destroy(err)
      debug('signed data, broadcasting')
      hub.broadcast(username, {
        signature: sig,
        from: opts.username,
        signal: signal
      }, function (err) {
        if (err) return stream.destroy(err)
      })
    })
  })

  return stream
}
