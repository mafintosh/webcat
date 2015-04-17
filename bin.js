#!/usr/bin/env node

var minimist = require('minimist')
var pump = require('pump')
var fs = require('fs')
var path = require('path')
var promptSync = require('prompt-sync')
var webcat = require('./')

var argv = minimist(process.argv.slice(2), {
  alias: {
    initiator: 'i',
    configure: 'c',
    username: 'u',
    signalhub: 's'
  }
})

var conf = {}
try {
  conf = JSON.parse(fs.readFileSync(path.join(process.env.HOME || process.env.USERPROFILE, '.config/webcat.json')))
} catch (err) {
  // do nothing
}

if (argv.configure || (!conf.username && !argv.username)) {
  process.stderr.write('Enter your github username' + (conf.username ? '(' + conf.username + ')' : '') + ': ')
  conf.username = promptSync().trim() || conf.username
  if (!conf.username) process.exit(1)

  try {
    fs.mkdirSync(path.join(process.env.HOME || process.env.USERPROFILE, '.config'))
  } catch (err) {
    // do nothing
  }

  fs.writeFileSync(path.join(process.env.HOME || process.env.USERPROFILE, '.config/webcat.json'), JSON.stringify(conf, null, 2) + '\n')
}

if (argv.configure) process.exit()
if (!argv.username) argv.username = conf.username

if (!argv._[0]) {
  console.error('Usage: webcat receivers-github-username')
  process.exit(1)
}

// webrtc keeps the eventloop running for some reason so we process.exit on close for now ...
pump(process.stdin, webcat(argv._[0], argv).on('close', process.exit), process.stdout)
