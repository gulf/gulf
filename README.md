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

document._change = function(cs, cb) {
  applyChanges(myTextarea, cs)
  cb()
}

document._setContents = function(newcontent, cb) {
  setContent(myTextarea, newcontent)
  cb()
}

document._collectChanges = functioncb() {
  if(!myTextarea.wasChanged()) return
  document.update(computeChanges()) // *bling*
  cb()
}
```

Before anything can happen, the document is initialized wwith `_setContents`.

Everytime the document is changed by an incoming edit `_change` is called with the changeset.

Before an incoming edit is processed `_collectChanges` is called, allowing you to save possible changes before the new edit is applied. Just like you'd git commit before git pulling anything -- we don't want things would get hairy.

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
Since adding gulf syncing to an editor is a repetitive task and hard to get right (what with selection retention, generating diffs, etc.) there are ready-made wrappers:

 * [contenteditable](https://github.com/marcelklehr/gulf-contenteditable)
 * [textarea/textinput](https://github.com/marcelklehr/gulf-textarea)
 * [codemirror](https://github.com/marcelklehr/gulf-codemirror)

## Storage adapters
Gulf allows you to store your data anywhere you like, if you can provide it with a storage adapter. It comes with an in-memory adapter, ready for you to test your app quickly, but when the time comes to get ready for production you will want to change to a persistent storage backend like mongoDB or redis.

Currently implemented adapters are:
 * [In-memory adapter](https://github.com/marcelklehr/gulf/blob/master/lib/MemoryAdapter.js)
 * [mongoDB adapter](https://github.com/marcelklehr/gulf-mongodb)

## API

### Class: gulf.Link

#### new gulf.Link([opts:Object])
Instantiates a new link, optionally with some options:
 * `opts.credentials` The credentials to be sent to the other end for authentication purposes.
 * `opts.authenticate` A functon which gets called with the credentials from the other side and has the following signature: `(credentials, cb(er, user))`
 * `opts.authorizeWrite` A function which gets called when the other end writes a message, and has the following signature: `(msg, user, cb(er, granted))`; `user` is the value returned by your `authenticate` hook.
 * `opts.authorizeRead` A function which gets called when this side of the link writes a message, and has the following signature: `(msg, user, cb(er, granted))`; `user` is the value returned by your `authenticate` hook.

Here's an example of how to setup link authentication and authorization:

```js
var link = new gulf.Link({
  authenticate: function(credentials, cb) {
    authenticate('token', credentials)
    .then((user) => {
      cb(null, user)
    })
    .catch(cb)
  }
, authorizeWrite: function(msg, user, cb) {
    switch(msg[0]) {
      case 'edit':
        authorize(user, 'document:change')
        .then(allowed => cb(null, allowed))
        .catch(cb)
        break;
      case 'ack':
      case 'requestInit':
        authorize(user, 'document:read')
        .then(allowed => cb(null, allowed))
        .catch(cb)
        break;
    }
  }
, authorizeRead:function(msg, user, cb) {
    switch(msg[0]) {
      case 'init':
      case 'edit':
        authorize(user, 'document:read')
        .then(allowed => cb(null, allowed))
        .catch(cb)
        break;
      case 'ack':
        authorize(user, 'document:change')
        .then(allowed => cb(null, allowed))
        .catch(cb)
        break;
    }
  }
})
```

### Class: gulf.Document

#### Event: init
Fired when the document has received an `init` message containing a snapshot, has reset the history and set the new contents.

#### Event: edit (edit:Edit)
Fired by `gulf.Document#dispatchEdit()` when an incoming edit has been approved by the master, has been sanitized applied to the document's contents

#### new gulf.Document(adapter, ottype)
Instantiates a new, empty Document.

#### gulf.Document.create(adapter, ottype, contents, cb)
Creates a documents with pre-set contents. `cb` will be called with `(er, doc)`.

#### gulf.Document.load(adapter, ottype, cb)
Loads a document from the storage. Since there's one instance of a storage adapter per document, you need to pass the information *which* document to load to the adapter instance. `cb` will be called with `(er, doc)`.

#### gulf.Document#slaveLink(opts:Object) : Link
Creates a link with `opts` passed to the Link constructor and attaches it as a slave link.

#### gulf.Document#masterLink(opts:Object) : Link
Creates a link with `opts` passed to the Link constructor and attaches it as a master link.

#### gulf.Document#attachMasterLink(link:Link)
Attaches an existing link as master.

#### gulf.Document#attachSlaveLink(link:Link)
Attaches an existing link as a slave.

#### gulf.Document#receiveInit(data:Object, fromLink:Link)
Listener function that gets called when a link attached to this document receives an `init` message. `data` could look like this: `{contents: 'abc', edit: '<Edit>'}`

#### gulf.Document#receiveEdit(edit:String, fromLink:Link, [callback:Function])
A listener function that gets called when a link receives an `edit` message. Adds the edit to the queue (after checking with a possible master) and calls Document#dispatchEdit() when ready.

#### gulf.Document#dispatchEdit(edit:Edit, fromLink:Link, cb:Function)
Checks with the document's History whether we know this edit already, and if not, whether we know its parent. If so, it calls Document#sanitizeEdit(), applies the edit to this document with Document#applyEdit(), add it to this document's History, send's an `ack` message to the link the edit came from, distributes the edit to any slaves and emits an `edit` event.

#### gulf.Document#sanitizeEdit(edit:Edit, fromLink:Link, cb:Function)
Transforms the passed edit against missed edits according to this document's history and the edit's parent information.

#### gulf.Document#applyEdit(edit:Edit)
Applies an edit to the document's content.

#### gulf.Document#distributeEdit(edit:Edit, [fromLink:Link])
Sends the passed edit to all attached links, except to `fromLink`.

### Class: gulf.EditableDocument
This class extends `gulf.Document` and overrides some of its methods.Most important among those are `gulf.EditableDocument#sanitizeEdit()` which is changed to transform the incoming edit against the ones queued in the master link and transform those against the incoming one, and `glf.EditableDocument#applyEdit` which is changed to call `_change` with the changes and the resulting contents.

#### gulf.EditableDocument#update(changes:mixed)
Update an editable document with local changes provided in `changes`. This wraps the changes in an Edit and sends them to master.

#### Event: update (edit:Edit)
Fired when EditableDocument#update() has been called, but before the changes have been approved by the master. `edit` is the newly created Edit.

#### gulf.EditableDocument#_change(cs:mixed, cb:Function)
Needs to be implemented by you or by wrappers (see [Editor wrappers](#editor-wrappers)). Is called after the document has been initialized with `_setContents` for every change that is received from master.

#### gulf.EditableDocument#_setContents(contents:mixed, cb:Function)
Needs to be implemented by you or by wrappers (see [Editor wrappers](#editor-wrappers)). Is called if the document receives an `init` message or to reset the document in case of an error.

#### gulf.EditableDocument#_collectChanges(cb:Function)
Needs to be implemented by you or by wrappers (see [Editor wrappers](#editor-wrappers)). Is called right before `_change()` is called to keep track of any outstanding changes. This isn't necessary if you call `update()` in an event handler that listens on local change events.

### Class: gulf.Edit

#### new Edit(ottype)
instantiates a new edit without parent, changes or id. Thus it's pretty useless.

#### gulf.Edit.unpack(json:String, ottype) : Edit
Deserializes an edit that was serialized using `gulf.Edit#pack()`.

#### gulf.Edit.newInitial(ottype) : Edit
Creates a new initial edit with a random id. Initial edits carry an id but no changes.

#### gulf.Edit.newFromChangeset(cs:mixed, ottype) : Edit
Creates a new edit with a random id and changes set to `cs`.

#### gulf.Edit.fromSnapshot(snapshot, ottype) : Edit
Recreates an edit from a Snapshot. A snapshot is how edits are stored in gulf. It's an object with {id, changes, parent, contents}, which should all be pretty self-explanatory.

#### gulf.Edit#apply(documentContents)
Applies this edit on a document snapshot.

#### gulf.Edit#folow(edit:Edit)
transforms this edit against the passed one and sets the other as this edit's parent. (This operation rewrites history.)

#### gulf.Edit#transformAgainst(edit:Edit)
transforms this edit against the passed one and without resetting this edit's parent.

#### gulf.Edit#merge(edit:Edit) : Edit
merges the passed edit with this one. Returns the new edit.

#### gulf.Edit#pack() : String
Serializes this edit.

#### gulf.Edit#clone() : Edit
Returns a new edit instance that has exactly the same properties as this one.

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
