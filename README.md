# Gulf [![Build Status](https://travis-ci.org/marcelklehr/gulf.png)](https://travis-ci.org/marcelklehr/gulf)

[![Join the chat at https://gitter.im/marcelklehr/gulf](https://badges.gitter.im/marcelklehr/gulf.svg)](https://gitter.im/marcelklehr/gulf?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

OT is too hard on you? The Gulf stream will sync your documents in real-time. Anywhere in the world, in node.js and the browser!

![Gulf stream (Public domain)](https://upload.wikimedia.org/wikipedia/commons/1/19/Golfstrom.jpg)

**Notice: This is the master branch and has the upcominging changes for v5.x, to find the docs for v4.x go to [stable](https://github.com/marcelklehr/gulf/tree/stable)!**

### How?
You choose an [OT](https://en.wikipedia.org/wiki/Operational_transformation) [type](https://github.com/marcelklehr/gulf#operational-transform-bling) algorithm, gulf will sync your documents.

## Show me!

```js
/*
 * Server
 */
var textOT = require('ot-text').type

// Create a new master document
var doc = gulf.Document.create('abc', {
  storageAdapter: new gulf.MemoryAdapter,
  ottype: textOT
})

// Set up a server
ws.createServer(function(socket) {
  // ... and create a slave link for each socket that connects
  var slave = doc.slaveLink()

  // now, add the new client as a slave
  // of alice's document
  socket.pipe(slave).pipe(socket)
})
```

```js
/*
 * Browser
 */
var textOT = require('ot-text').type

// Create a new *editable* slave document (empty by default)
var doc = new gulf.EditableDocument({
  storageAdapter: new gulf.MemoryAdapter,
  ottype: textOT
})

// Implement editor bindings
doc._onBeforeChange = function() {/*...*/}
doc._onChange = function() {/*...*/}
doc._setContent = function() {/*...*/}

// Connect to alice's server
ws.connect(function(socket) {
  // create a link to the master
  var master = doc.masterLink()

  // connect bob's document to Alice's master document
  socket.pipe(master).pipe(socket)
})
```

And you have a collaborative editor!

### Extensions
You can sync any document type you have an ot type implementation and an editor for.

Since adding gulf syncing to an editor is a repetitive task and hard to get right (what with selection retention, generating diffs, etc.) there are ready-made bindings for you!

The following bindings are available:

 * [contenteditable](https://github.com/marcelklehr/gulf-contenteditable) (using DOM OT; eg. CKeditor)
 * [textarea/textinput](https://github.com/marcelklehr/gulf-textarea) (using text OT)
 * [codemirror](https://github.com/marcelklehr/gulf-codemirror) (using text OT)
 * [socialcalc](https://github.com/marcelklehr/gulf-socialcalc) (using socialcalc OT)
 * [quill](https://github.com/marcelklehr/gulf-quill) (using rich text OT)

### Above and Beyond
Check out [Hive.js](http://hivejs.org) a collaboration platform with gulf at its core.

## Usage

### Documents
A document may contain arbitrary data. The content of a document is available in `myDocument.content` (which is read-only!).

Now, how do I change this document if `Document#content` is untouchable? Well, thankfully there's also EditableDocuments.

### Editable Documents
Editable documents can be updated via the `submitChange(cs)` method. The `cs` is short for changeset. A changeset contains the changes to a document.

EditableDocuments leave some methods for you to implement:

```js
var document = new gulf.EditableDocument(adapter, ottype)

document._onChange = function(cs, cb) {
  /*
  apply changes
  return promise
  */
}

document._setContent = function(newcontent, cb) {
  /*
  set new content
  return promise
  */
}

document._onBeforeChange = functioncb() {
  /*
  collect changes and submitChange() them
  return promise
  */
}
```

Before anything can happen, the editable document is initialized wwith `_setContent`.

Everytime the document is changed by an incoming edit `_onChange` is called with the changeset.

Before an incoming edit is processed `_onBeforeChange` is called, allowing you to save possible changes before the new edit is applied. Just like you'd git commit before git pulling anything -- we don't want things would get hairy.

There are two ways to get a changeset: 1) you compute a diff between the last known state and the current one. 2) You record edit events and turn them into a changeset. There are editors which provide changesets out-of-the-box, others will have to be persuaded (using diff computation).

Ok, now we update our editable document and we notice that it keeps a record of all revisions -- documents remember every change ever done. Nice.

### Linking documents
Now, Alice and Bob each have an editable document and want to sync them. For this, we need some kind of mediator document that takes care of the syncing process and represents *the absolute truth*. In gulf this mediator is called the master document. It has the final say in which edit is accepted and how the edits are ordered.

Now, somehow Alice and Bob need to link their documents to that master document in order to send it the changes they make.

For this gulf provides, surprise, Links. A Link is a simple DuplexStream. If Alice wants to connect to the master document, she creates a master link to it. The master document attaches Alice's link as a slave link.

```js
net.createserver((socket) => {
  socket.pipe(masterDoc.slaveLink()).pipe(socket) // for each socket
}).listen(1234)
```

```js
net.connect(1234,function(er, socket) {
  socket.pipe(slaveDoc.masterLink()).pipe(socket)
})
```

A document can have many slaves, but only one master link (EditableDocuments have no slave links).

Now that we've connected all documents, every time Alice or Bob make a change the edits will just flow to the other documents.

## Operational transform
Gulf expects you to provide an OT library that adhere's to [shareJs's OT type spec](https://github.com/share/ottypes#spec).

You can use [shareJS's built in ottypes](https://github.com/share/ottypes) or  [some other](https://github.com/marcelklehr/changesets) [libraries](https://github.com/marcelklehr/dom-ot).

## Storage adapters
Gulf allows you to store your data anywhere you like, if you can provide it with a storage adapter. It comes with an in-memory adapter, ready for you to test your app quickly, but when the time comes to get ready for production you will want to change to a persistent storage backend like mongoDB or redis.

Currently implemented adapters are:
 * [In-memory adapter](https://github.com/marcelklehr/gulf/blob/master/lib/MemoryAdapter.js)
 * [mongoDB adapter](https://github.com/marcelklehr/gulf-mongodb)

If you'd like to write your own storage adapter, head on to the API docs.

## Examples / Gulf in the wild
It's probably easiest to observe gulf in action. So, have a look at these examples.

 * https://gist.github.com/marcelklehr/0430be7e3fb45a83189b -- a small html page with two contenteditables that are synced.
 * https://github.com/marcelklehr/warp -- a complete web server serving a collaborative editor, driven by CKeditor, sockJS and gulf-contenteditable
 * http://openevocracy.org/ -- a new take on democratic decision-making, with gulf as the real-time editing engine.

**Additions wanted:** If you have the perfect example show-casing gulf or its related libraries leave me a note via email or [the issues](https://github.com/marcelklehr/gulf/issues).

## API

### Class: gulf.Link

#### new gulf.Link([opts:Object])
Instantiates a new link, optionally with some options:
 * `opts.credentials` The credentials to be sent to the other end for authentication purposes.
 * `opts.authenticate` A functon which gets called with the credentials from the other side and has the following signature: `(credentials): Promise<Object>`
 * `opts.authorizeWrite` A function which gets called when the other end writes a message, and has the following signature: `(msg, user): Promise<Bool>`; `user` is the value returned by your `authenticate` hook.
 * `opts.authorizeRead` A function which gets called when this side of the link writes a message, and has the following signature: `(msg, user): Promise<Bool>`; `user` is the value returned by your `authenticate` hook.

The return value of `opts.authenticate` is also used as the author field when saving snapshots.

Here's an example of how to setup link authentication and authorization:

```js
var link = new gulf.Link({
  authenticate: function(credentials) {
    return authenticate('token', credentials)
    .then((user) => {
      return user.id
    })
  }
, authorizeWrite: function(msg, userId, cb) {
    switch(msg[0]) {
      case 'edit':
        return authorize(userId, 'document:change')
        .then(auth => auth.granted)
      case 'requestInit':
        return authorize(userId, 'document:read')
        .then(auth => auth.granted)
    }
  }
, authorizeRead:function(msg, userId, cb) {
    switch(msg[0]) {
      case 'init':
      case 'edit':
        return authorize(userId, 'document:read')
        .then(auth => auth.granted)
      case 'ack':
        return authorize(userId, 'document:change')
        .then(auth => auth.granted)
    }
  }
})
```

### Class: gulf.Document

#### Event: init
Fired when the document has received an `init` message containing a snapshot, has reset the history and set the new contents.

#### Event: commit (edit:Revision, ownEdit:Boolean)
Fired when an edit has been committed (confirmed with master, applied locally and stored). `ownEdit` tells you if `edit` was submitted by this document or was received from a different document.

#### new gulf.Document(opts: Object({adapter, ottype}))
Instantiates a new, empty Document.

#### gulf.Document.create(content, opts:Object): Document
Creates a documents with pre-set contents. `opts` will be passed to the Document constructor.

#### gulf.Document.load(documentId, opts:Object): Document
Loads a document from the storage. `opts` will be passed to the Document constructor.

#### gulf.Document#slaveLink(opts:Object) : Link
Creates a link with `opts` passed to the Link constructor and attaches it as a slave link.

#### gulf.Document#masterLink(opts:Object) : Link
Creates a link with `opts` passed to the Link constructor and attaches it as a master link.

#### gulf.Document#attachMasterLink(link:Link)
Attaches an existing link as master.

#### gulf.Document#attachSlaveLink(link:Link)
Attaches an existing link as a slave.

#### gulf.Document#receiveInit(data:Object, fromLink:Link):Promise
Listener function that gets called when a link attached to this document receives an `init` message. `data` could look like this: `{contents: 'abc', edit: '<Edit>'}`

#### gulf.Document#receiveEdit(edit:String, fromLink:Link): Promise
A listener function that gets called when a link receives an `edit` message. Adds the edit to the queue (after checking with a possible master) and calls Document#dispatchEdit() when ready.

#### gulf.Document#dispatchEdit(edit:Edit, fromLink:Link): Promise
Checks with the document's History whether we know this edit already, and if not, whether we know its parent. If so, it calls Document#sanitizeEdit(), applies the edit to this document with Document#applyEdit(), add it to this document's History, send's an `ack` message to the link the edit came from, distributes the edit to any slaves and emits an `edit` event.

#### gulf.Document#sanitizeEdit(edit:Edit, fromLink:Link): Promise
Transforms the passed edit against missed edits according to this document's history and the edit's parent information.

#### gulf.Document#applyEdit(edit:Edit): Promise
Applies an edit to the document's content.

#### gulf.Document#distributeEdit(edit:Edit, [fromLink:Link])
Sends the passed edit to all attached links, except to `fromLink`.

### Class: gulf.EditableDocument(options)
This class extends `gulf.Document` and overrides some of its methods.

The following are the defaults for the options (just `mergeQueue` at this time):
```
{
  mergeQueue: true // If gulf should merge multiple outstanding edits into one, for faster collaboration.
}
```

#### Event: init
Fired when gulf has received the init packet and has set the contents via `EditableDocument#_setContent`.

#### Event: commit (edit:Revision, ownEdit:Boolean)
Fired when an edit has been committed (confirmed with master, applied locally and stored). `ownEdit` tells you if `edit` was submitted by this document or was received from a different document.

#### gulf.EditableDocument#submitChange(changes:mixed)
Update an editable document with local changes provided in `changes`. This wraps the changes in an Edit and sends them to master.

#### Event: submit (edit:Revision)
Fired when EditableDocument#update() has been called, but before the changes have been approved by the master. `edit` is the newly created Edit.

**Note:** If queue merging is enabled, the supplied edit may be merged with other outstanding edits before being sent to the server. Thus, if queue merging is enabled, it is not guaranteed that you will get a `commit` event for every edit that you got an `update` event for.

#### gulf.EditableDocument#_onChange(cs:mixed) : Promise
Needs to be implemented by you or by wrappers (see [Editor wrappers](#editor-wrappers)). Is called after the document has been initialized with `_setContents` for every change that is received from master.

#### gulf.EditableDocument#_setContent(content:mixed) : Promise
Needs to be implemented by you or by wrappers (see [Editor wrappers](#editor-wrappers)). Is called if the document receives an `init` message or to reset the document in case of an error.

#### gulf.EditableDocument#_onBeforeChange() : Promise
Needs to be implemented by you or by wrappers (see [Editor wrappers](#editor-wrappers)). Is called right before `_onChange()` is called to keep track of any outstanding changes.

### Class: gulf.Revision

#### new Revision(ottype)
instantiates a new edit without parent, changes or id. Thus it's pretty useless.

#### gulf.Revision.fromJSON(json:String, ottype) : Revision
Deserializes an edit that was serialized using `gulf.Edit#toJSON()`.

#### gulf.Revision.newInitial(ottype) : Revision
Creates a new initial edit with a random id. Initial edits carry an id but no changes.

#### gulf.Revision.newFromChangeset(cs:mixed, ottype) : Revision
Creates a new edit with a random id and changes set to `cs`.

#### gulf.Revision#apply(documentContents)
Applies this edit on a document snapshot.

#### gulf.Revision#follow(edit:Revision)
transforms this edit against the passed one and sets the other as this edit's parent. (This operation rewrites history.)

#### gulf.Revision#transformAgainst(edit:Revision)
transforms this edit against the passed one and without resetting this edit's parent.

#### gulf.Revision#merge(edit:Revision) : Revision
merges the passed edit with this one. Returns the new edit.

#### gulf.Revision#toJSON() : Object
Serializes this edit.

#### gulf.Revision#clone() : Revision
Returns a new edit instance that has exactly the same properties as this one.

### Adapter
A revision is an object that looks like this:

```js
{
  id: 'sdgh684eb68eth'
, changeset: [0, "h"]
, parent: '5dfhg68aefh65ae' // ID of another snapshot
, content: '"Hello world"' // stringified representation of the new contents
, author: 12 // The id of the author, as returned by `opts.authenticate` in the Link options (or the value you passed to gulf.Document#receiveEdit, if you passed in the edit directly)
}
```

If you're having trouble writing your own adapter, check out [the in-memory adapter](https://github.com/marcelklehr/gulf/blob/master/lib/MemoryAdapter.js) and the [mongoDB adapter](https://github.com/marcelklehr/gulf-mongodb).

#### Adapter#createDocument(initialSnapshot) : Promise<DocumentId>
#### Adapter#getLastRevision(docId) : Promise<Revision>
#### Adapter#storeRevision(docId, revision) : Promise
#### Adapter#existsRevision(docId, editId) : Promise<Boolean>
#### Adapter#getRevisionsAfter(docId, editId) : Promise<Array<Revision>>

## Tests?
[![Sauce Test Status](https://saucelabs.com/browser-matrix/gulf.svg)](https://saucelabs.com/u/gulf)

### Test-it-yourself
To run the tests in node and the browser, run the following:
```
npm run build && npm run test-local
```

(Make sure to open the provided link in the browser of your choice.)

## License
(c) 2013-2016 by Marcel Klehr

GNU Lesser General Public License

## Changelog

v4.1.0
 * EditableDoc: add Event `editableInitialized`
 * EditableDoc: add Event `commit`
 * Add option `mergeQueue`
    
v4.0.5
 * Fix memory leak: Doc#detachLink on Link:'finish'

v4.0.4
 * Fix reconnect catching-up

v4.0.3
 * Clear sentEdit timeout on Link#reset
 * Remove pointless guard in Link#send

v4.0.2
 *  Fix createDocument. history wasn't passing on doc.id
 *  Change code header: LGPL

v4.0.1
 * License under LGPL :fireworks:

v4.0.0
 * Revamp Adapter interface
 *  Add author to snapshots: Use link.authenticated as author value
 *  Implement commit retry: Default edit sending timeout is 10s
 *  Revamp auth: Clearly separate authentication from authorization
