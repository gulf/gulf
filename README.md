# Telepath
Telepath makes it easy to link documents to make sure they stay in sync.

Eventually this should work between server and brower, too, but it doesn't work as of yet. This is alpha software, by no means stable, nor is the API finalized. Yet, it already works.

## Show me!

```js
var telepath = require('telepath')

var docA = telepath.Document.create('abc') // Amy's document is 'abc'
  , docB = new telepath.Document // Bob has no content, yet.

var ASlave = docA.createSlaveLink()
  , BMaster = docB.createMasterLink()

// Now, we link the two documents!
ASlave.pipe(BMaster).pipe(ASlave)
```

Now, wait a milisecond...

```js
docB.content // 'abc' -- Synced.
```

Wow.

It is important to note that those two documents can be anywhere in the world as long as you can connect them with a socket (you'll just have to pipe your tcp stream to the link you created and the other way 'round). You can also have more than one document, as long as there's always a central master document, -- it'll still work.


## Implementation Details
Telepath uses operational transformation, which is all about making edits fit. The new Node.js streams make sure linking documents is a joy for both me, the developer, and you, the developer (this was of course originally an idea of Joseph Gentle's).

Why can't it do peer-to-peer linking? Well, Peer to peer is a pain-in-the-ass scenario with operational transformation and not at all performant, but that's not my final word on tp2, I'm just too swamped to implement that properly, so I thought, let's leave that for later.

## Tests?
```
> mocha
```

## License
(c) 2013 by Marcel Klehr  
MIT License