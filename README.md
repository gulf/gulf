# Gulf [![Build Status](https://travis-ci.org/marcelklehr/gulf.png)](https://travis-ci.org/marcelklehr/gulf)
OT is too hard on you? The Gulf stream will sync your documents in real-time. Anywhere in the world, in node.js and the browser!

![Gulf stream (Public domain)](https://upload.wikimedia.org/wikipedia/commons/1/19/Golfstrom.jpg)


### How?
You choose an [OT](https://en.wikipedia.org/wiki/Operational_transformation) [type](https://github.com/marcelklehr/gulf#operational-transform-bling) algorithm, gulf will sync your documents.

## Show me!

```js
/*
 * Alice
 */
var textOT = require('ottypes').text

// Create a new master document
gulf.Document.create(new gulf.MemoryAdapter, textOT, 'abc', function(er, doc) {
  if(er) throw er

  // Set up a server
  net.createServer(function(socket) {
    // ... and create a slave link for each socket that connects
    var slave = doc.slaveLink()

    // now, add the new client as a slave
    // of alice's document
    socket.pipe(slave).pipe(socket)
  })
  // listen for connections
  .listen(7453)
})
```

```js
/*
 * Bob
 */
var textOT = require('ottypes').text

// Create a new slave document (empty by default)
var doc = new gulf.Document(new gulf.MemoryAdapter, textOT)

// Connect to alice's server
net.connect(7453, function(socket) {
  // create a link to the master
  var master = a.masterLink()

  // connect bob's document to Alice's master document
  socket.pipe(master).pipe(socket)
})
```

And they'll stay in sync.

## Usage

## Documents
A document may contain arbitrary data (as long as you provide an ottype that can handle that kind of data, but we're getting ahead of ourselves). The content of a document is available in `myDocument.content` (which is read-only for you!) and that's basically all a document can do.

Now, how do I change this document if `Document#content` is untouchable? Well, thankfully there's also EditableDocuments.

Editable documents can be updated via the `update(cs)` method. The `cs` stands for changeset. A changeset contains the changes to a document. (There are many ways you can create such a changeset, right now we use the simple method of imagination: *bling* -- there it is, see it?)

Ok, now we update our editable document and we notice that it keeps a record of all revisions -- all documents remember every change ever done. Nice.

## Linking documents
Now, Alice and Bob each have a document, actually it's "the same" document. At least it should be, oh -- wait: Bob has made some changes to his version, and Alice of course couldn't resist to write some introductory paragraph again.

Now it's not the same document anymore -- but if we connect the two, they'll always be in sync, right? We just need some kind of mediator that takes care of the syncing process to keep things sane (imagine, if David had changed his document, too!).

This mediator is also in possession of, surprise, a Document. It's doesn't need to be editable, though. Now, somehow Alice and Bob need to link their documents to that master document and send it the changes they make.

Well, Links we have. If Alice wants to connect to the master document, she creates a Link to it and attaches it to her document as a master link. The master document attaches Alice's link as a slave link.

A document can have many slave links, but only one master link ( EditableDocuments have no slave links, but you can always put another document in front of them).

Now that we've connected all documents, every time Alice or Bob make a change the edits will just flow to the other documents.

## In javascript, please
Since we're in a globalized world we can't expect all documents to be on the same machine. That's why a Link is a simple DuplexStream. You may pipe it to a tcp socket or a websocket or some other stream. Of course that means that you need two instances of a Link -- one for each side of the connection.

```js
masterDoc = new gulf.Document(adapter, ot)

socket.pipe(masterDoc.slaveLink()).pipe(socket)
```

```js
slaveDoc = new gulf.Document(adapter, ot)

socket.pipe(slaveDoc.masterLink()).pipe(socket)
```

We will call two links connected through a pipe, a "pipeline". If a pipeline is attached as master on one end, it must be attached as slave on the other end, consequently. (Don't shoot yourself in the foot by attaching a pipeline as master on both ends!)

EditableDocuments leave some methods for you to implement:

```js
var document = new gulf.EditableDocument(adapter, ottype)

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
Gulf expects you to provide an OT library that adhere's to [shareJs's OT type spec](https://github.com/share/ottypes#spec).

You can use [shareJS's built in ottypes](https://github.com/share/ottypes) or  [some other](https://github.com/marcelklehr/changesets) [libraries](https://github.com/marcelklehr/dom-ot).

For example, you could use shareJS's OT engine for plain text.
```js
var gulf = require('gulf')
  , textOT = require('ottypes').text

var document = new gulf.Document(new gulf.MemoryAdapter, textOT)
```

## Editor wrappers
Since adding gulf syncing to an editor is a repetitive task and ard to get right (what with selection retention, generating diffs, etc.) there are wrappers, of course:

 * [contenteditable](https://github.com/marcelklehr/gulf-contenteditable)
 * [textarea/textinput](https://github.com/marcelklehr/gulf-textarea)

## Storage adapters
Gulf allows you to store your data anywhere you like, if you can provide it with a storage adapter. It comes with an in-memory adapter, ready for you to test your app quickly, but when the time comes to get ready for production you will want to change to a persistent storage backend like mongoDB or redis.

Currently implemented adapters are:
 * [In-memory adapter](https://github.com/marcelklehr/gulf/blob/master/lib/MemoryAdapter.js)
 * [mongoDB adapter](https://github.com/marcelklehr/gulf-mongodb)

## FAQ

How does it work? Gulf uses operational transformation, which is all about making edits fit. Node.js streams make sure linking documents is a pure joy. Everything else is in teh codez.

Does it support peer-to-peer linking? No.

Why? Well, Peer-to-peer is a pain-in-the-ass scenario with operational transformation and not at all performant. If you have a peer-to-peer scenario electing a master might be easier.

## Tests?
```
> mocha
```

## License
(c) 2013-2015 by Marcel Klehr

GNU General Public License
