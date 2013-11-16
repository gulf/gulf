# Telepath [![Build Status](https://travis-ci.org/marcelklehr/telepath.png)](https://travis-ci.org/marcelklehr/telepath)
Link documents and they'll stay in sync. Anywhere in the world, in node.js and the browser!

*This is alpha software, thus it's by no means stable, nor is the API finalized. Yet, it already works!*

## Show me!
<table>
<tr>
<td>

```js
/*
 * ALICE
 */
var telepath = require('telepath')
  , net = require('net')

var doc = telepath.Document.create('abc')

doc.content // 'abc'

net.createServer(function(socket) {
  // create a slave link 
  var link = doc.createSlaveLink()

  // connect the client as a slave
  // of alice's document
  socket.pipe(link).pipe(socket)
})
// listen for connections
.listen(7453)
```

</td>
<td>

```js
/*
 * BOB
 */
var telepath = require('telepath')
  , net = require('net')

var doc = new telepath.Document

doc.content // null

net.connect(7453, function(socket) {
  // create a link to a master for bob
  var link = a.createMasterLink()

  // connect bob's document with Alice's
  socket.pipe(link).pipe(socket)
})


// -
```

</td>
</tr>
<tr>
<td>
</td>
<td>

```js
  // now let's wait a bit...
  setTimeout(function() {
    doc.content // 'abc'
  }, 100)
```

</td>
</tr>
</table>

This is not a one-time thing. There are also `EditableDocument`s that stay in sync while you alter them.

## Usage

## Documents and links
So, there's `Document`s and `Link`s between them. When attaching a link to a document, you need to tell it, if it should be a master or a slave link.

```js
var a = telepath.Document.create('abc')
  , b = new telepath.Document

var linkA = new telepath.Link
a.attachSlaveLink(linkA)

var linkB = new telepath.Link
b.attachMasterLink(linkB)
```

Every document can have many slave links, but only one master link. *Two* links connected through a pipe form a pipeline. If a pipeline is attached as master on one end, it must be attached as slave on the other end, consequently. (Don't shoot yourself in the foot by attaching a pipeline as master on both ends, <del>it'll eat your dog</del> it won't work.)

```js
linkA.pipe(linkB).pipe(linkA)
```

Usually, the two docs are usually not in the same environment, usually not even on the same machine. In order to connect them anyway just establish a connection between them (e.g. a TCP connection, or a websocket using shoe) and pipe your links to the raw stream on both ends (as seen above).

## Operational transform
Telepath expects you to provide an OT library that adhere's to [shareJs's OT type spec](https://github.com/share/ottypes#spec).

For example, you could use shareJS's OT engine for plain text.
```js
var telepath = require('telepath')
  , telepath.ot = require('ottypes').text
```

## How does it work?
Telepath uses operational transformation, which is all about making edits fit. Node.js streams make sure linking documents is a pure joy.

Why can't it do peer-to-peer linking? Well, Peer-to-peer is a pain-in-the-ass scenario with operational transformation and not at all performant, but that's not my final word on tp2, I'm just too swamped to implement that properly, so I thought, let's leave that for later.

## Tests?
```
> mocha
```

and

```
test.html
```

## Todo

* Allow people to use their own ot lib
* Check whether objects might get ripped apart in raw streams
* Catch misusage (i.e. attaching the same link twice to the same or different docs, employing a pipeline as master on both ends, piping a link twice -- is that even possible?)

## License
(c) 2013 by Marcel Klehr  
MIT License