# Telepath
Link documents and they'll stay in sync. Anywhere in the world, in node.js and the browser!

This is alpha software, thus it's by no means stable, nor is the API finalized. Yet, it already works.

## Show me!

```js
var telepath = require('telepath')



// We have two documents

var a = telepath.Document.create('abc')
  , b = new telepath.Document

a.content // 'abc' - Amy sees 'abc'
b.content // null - Bob has no content yet.



// Now, let's link the two documents!

var linkA = a.createSlaveLink()
  , linkB = b.createMasterLink() // bob's document is gonna be a slave of amy's.

linkA.pipe(linkB).pipe(linkA)



// Now, wait a few miliseconds...

a.content // 'abc'
b.content // 'abc'
```

Wow.

## How does it work?
Telepath uses operational transformation, which is all about making edits fit. Node.js streams make sure linking documents is a pure joy.

Why can't it do peer-to-peer linking? Well, Peer-to-peer is a pain-in-the-ass scenario with operational transformation and not at all performant, but that's not my final word on tp2, I'm just too swamped to implement that properly, so I thought, let's leave that for later.

## Tests?
```
> mocha
```

and

`test.html`

## License
(c) 2013 by Marcel Klehr  
MIT License