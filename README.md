# webcat

Mad science p2p pipe across the web using webrtc that uses your Github private/public key for authentication and a [signalhub](https://github.com/mafintosh/signalhub) for discovery

We also want to support other key hosts beyond Github. If you have suggestions or want to help implement this check out [this issue](https://github.com/mafintosh/webcat/issues/5).

```
npm install -g webcat
```

If you have trouble getting it to compile try following the [wrtc install instructions](https://github.com/js-platform/node-webrtc#prerequisites)

## Usage

webcat lets you establish a p2p pipe to other github users over the web.
Let's say I wanted to connect to [@maxogden](https://github.com/maxogden)

First I need to configure webcat once

```
webcat --configure
Enter your github username: mafintosh
```

Then on my machine I run

```
webcat maxogden
hello max
```

On Max's machine he runs

```
webcat mafintosh
hi mathias
```

webcat will create a p2p pipe between connect me and max by using a [signalhub](https://github.com/mafintosh/signalhub) to exchange webrtc metadata
and Github private/public keys to authenticate that Max is actually [@maxogden](https://github.com/maxogden) and that I am actually [@mafintosh](https://github.com/mafintosh)

On my machine my prompt now looks like

```
webcat maxogden
hello max
hi mathias
```

And on Max's machine it now looks like

```
webcat mafintosh
hi mathias
hello max
```

## How it works

webcat works the following way

1. First you sign a message that says you want to connect to another user using your Github private key
2. You post this message to a known [signalhub](https://github.com/mafintosh/signalhub) in the channel /{another-username}
3. The other user does the same thing only they posts it to the channel /{my-username}
4. One of you receives the connect message and verifies that it came from the right person by looking up the other users public key using https://github.com/{another-username}.keys (and this will work in the browser if Github adds CORS GET to this API!)
5. You then create a webrtc signal handshake, sign it and post it to the other user's lobby
6. The other user receives this and posts back a signed version of their signaling data
7. You use this data to establish a secure webrtc connection between eachother that is encrypted using DTLS
8. You are now connected :)

**warning**. we invented the first 6 parts of this scheme. it has not been properly peer reviewed so use at your own risk :)

we use the following crypto dependencies:

* openssl from node core (rsa signing and https for fetching public keys)
* dtls from webrtc

## Use cases

You can use webcat to pipe files across the internet!

On my machine

```
webcat maxogden < some-file
```

On Max's machine

```
webcat mafintosh > some-file
```

## Pipe to yourself

Assuming you have your github key on two different machines you can also open and pipe between them by using the same username.

On one machine connected to the internet that has your Github key

```
echo machine one | webcat mafintosh
```

On another machine connected to the internet that has your Github key

```
echo machine two | webcat mafintosh
```

## Programmatic usage

You can use webcat from node as well.

``` js
var webcat = require('webcat')

var stream = webcat('mafintosh') // put in the name of the person you want to talk to
process.stdin.pipe(stream).pipe(process.stdout)
```

## License

MIT
