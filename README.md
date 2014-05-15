# Telepath [![Build Status](https://travis-ci.org/marcelklehr/telepath.png)](https://travis-ci.org/marcelklehr/telepath)
Link documents and they'll stay in sync. Anywhere in the world, in node.js and the browser!

*This is alpha software, thus it's by no means stable, nor is the API finalized. Yet, it already works!*

## Show me!

```js
/*
 * ALICE
 */
var telepath = require('telepath')
  , net = require('net')
  , textOT = require('ottypes').text

var doc = telepath.Document.create(textOT, 'abc')

doc.content // 'abc'

net.createServer(function(socket) {
  // create a slave link for each socket
  var slave = doc.slaveLink()

  // connect the client as a slave
  // of alice's document
  socket.pipe(slave).pipe(socket)
})
// listen for connections
.listen(7453)
```

```js
/*
 * BOB
 */
var telepath = require('telepath')
  , net = require('net')
  , textOT = require('ottypes').text

var doc = new telepath.Document(textOT)

doc.content // null

net.connect(7453, function(socket) {
  // create a link to a master for bob
  var master = a.masterLink()

  // connect bob's document with Alice's (Alice is master)
  socket.pipe(master).pipe(socket)
})


  // now if we wait a bit...
  setTimeout(function() {
    doc.content // 'abc'
  }, 100)
```

This is not a one-time thing. There are also `EditableDocument`s that stay in sync whilst you alter them.

## Usage

## Documents
A document may contain arbitrary data (as long as you provide an ottype that can handle that kind of data, but we're getting ahead of ourselves). The content of a document is available in `myDocument.content` (which is read-only for you!) and that's basically all a document can do.

Now, how do I change this document if that `Document#content` property is untouchable? Well, thankfully there's also an EditableDocument.

Editable documents can be updated via the `update(cs)` method. The `cs` stands for changeset. A changeset contains the changes to a document. (There are many ways you can create such a changeset, right now we use the simple method of imagination: *bling* -- there it is, see it?)

Ok, now we update our editable document and we notice that it keeps a record of all revisions -- it remembers every change we ever made. Nice.

## Linking documents
Now, Alice and Bob each have a document. Actually it's "the same" document. At least it should be, oh -- wait: Bob has made some changes to his version, and Alice of course couldn't resist to write some introductory paragraph again.

Now it's not the same document anymore -- but we could sync the two. We just need some kind of mediator that takes care of the syncing process to keep things sane (imagine, if David had changed his document, too!).

This mediator thingy is also in possession of, surprise, a Document. It's not editable, though. Now, somehow Alice and Bob need to link their documents to that master document and send it the changes they made.

Well, Links we have. If Alice wants to connect to the master document, she creates a Link to it and attaches it to her document as a master link. The master document attaches Alice's link as a slave link.

A document can have many slave links, but only one master link ( EditableDocuments have no slave links, but you can always put another document in front of them).

Now that we've connected all documents, every time Alice or Bob make a change the edits will just flow to the other documents.

## In javascript, please
Since we're in a globalized world we can't expect all documents to be on the same machine. That's why a Link is a simple DuplexStream. You may pipe it to a tcp socket or a websocket or some other stream. Of course that means that you need two instances of Link -- one for each document you want to connect.

```js
masterDoc = new telepath.Document(ot)

socket.pipe(masterDoc.slaveLink()).pipe(socket)
```

```js
slaveDoc = new telepath.Document(ot)

socket.pipe(slaveDoc.masterLink()).pipe(socket)
```

We will call two links connected through a pipe, a "pipeline". If a pipeline is attached as master on one end, it must be attached as slave on the other end, consequently. (Don't shoot yourself in the foot by attaching a pipeline as master on both ends!)

EditableDocuments leave some methods for you to implement:

```js
var document = new telepath.EditableDocument(ottype)

document._change = function(newcontent, cs) {
  if(cs) {
    applyChanges(myTextarea, cs)
  }
  else {
    setContent(myTextarea, newcontent)
  }
}

document._collectChanges = function() {
  if(!myTextarea.wasChanged()) return
  document.update(computeChanges()) // *bling*
}
```

Everytime the document is changed by an incoming edit `_change` is called with the new contents and the changeset (upon initializing the document it may get called only with the new content).

Before an incoming edit is processed `_collectChanges` is called allowing you to save possible changes before the new edit is applied. Just like you'd git commit before git pulling anything -- we don't want things would get hairy.

## Operational transform *bling*
Telepath expects you to provide an OT library that adhere's to [shareJs's OT type spec](https://github.com/share/ottypes#spec).

You can use [shareJS's built in ottypes](https://github.com/share/ottypes) or  [other](https://github.com/marcelklehr/changesets) [libraries](https://github.com/marcelklehr/dom-ot).

For example, you could use shareJS's OT engine for plain text.
```js
var telepath = require('telepath')
  , textOT = require('ottypes').text

var document = new telepath.Document(textOT)
```

## How does it work?
Telepath uses operational transformation, which is all about making edits fit. Node.js streams make sure linking documents is a pure joy.

Why can't it do peer-to-peer linking? Well, Peer-to-peer is a pain-in-the-ass scenario with operational transformation and not at all performant, but that's not my final word on tp2, I'm just too swamped to implement it properly right now, so I thought, let's leave it for later.

## Tests?
```
> mocha
```

and

```
test.html
```

## Todo

* Check whether objects might get ripped apart in raw streams
* Catch misusage (i.e. attaching the same link twice to the same or different docs, employing a pipeline as master on both ends, piping a link twice -- is that even possible?)

## License
(c) 2013-2014 by Marcel Klehr
MIT License
