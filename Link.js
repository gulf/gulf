var Duplex = require('stream').Duplex

// uses nodeJS streams API on the public facing side
// and events for ack, edit, etc. internally (listened on by Document; namespace: 'link:')
// additional events on link: error

// XX Must have the same terminology of #awaitingAck and #sent as prismIO.connection
function Link () {
  Duplex.call(this, {allowHalfOpen: false, objectMode: true})

  this.on('error', function(er) {
    console.warn('Error in link', er.stack || er)
    this.end()
    // i dunno what to do here...
  }.bind(this))
  
  // Never touch the edits in a queue of a non-master link!
  // (Imagine with no master link you were to transform a pending edit against an incoming one, but the pending edit has
  // already been added to the document's history -- so a new local edit would have the same parent (the incoming one) as the pending edit before it.
  // this leads to unexpected results..)
  this.queue = []
  
  this.callbacks = {}
}
Link.prototype = Object.create(Duplex.prototype, { constructor: { value: Link }})

module.exports = Link

/**
 * Pipeline an event
 */
Link.prototype.send = function(/*event, args..*/) {
  //console.log('->', arguments)
  this.push(JSON.stringify(Array.prototype.slice.call(arguments)))
}

/*
 * Put an edit into the queue
 */
Link.prototype.sendEdit = function(edit, cb) {
  if(this.sentEdit || this.queue.length) this.queue.push(edit)
  else this.send('edit', (this.sentEdit = edit).pack())

  if(cb) this.callbacks[edit.id] = cb
}

Link.prototype._read = function() {
  if(!this.queue[0]) return // Everything other than edits gets pushed directly in Link#send()
  if(this.sentEdit) return
  
  this.sentEdit = this.queue.unshift()
  this.send('edit', this.sentEdit.pack())
}

Link.prototype._write = function(buf, enc, cb) {
  //console.log('<- _write:', buf.toString(enc))
  var args = JSON.parse(buf.toString(enc))
  
  // Intercept acks for shifting the queue and calling callbacks
  if(args[0] == 'ack' && args[1] == this.sentEdit.id) {
    this.sentEdit = null
    if(this.callbacks[args[1]]) {
      this.callbacks[args[1]]() // XXX Better make this a setImmediate
      delete this.callbacks[args[1]]
    }
  }
  
  args[0] = 'link:'+args[0]
  this.emit.apply(this, args)
  cb()
}