var Duplex = require('stream').Duplex

var nextTick = 'undefined' == typeof setImmediate? require('next-tick') : setImmediate


/**
 * This is a Link
 * The public should interact with it via node's streams API (ie. using .pipe etc.)
 * Internally, it emits events ("link:*") that are picked up by the Document it is attached to.
 */

// XX Must have the same terminology of #awaitingAck and #sent as prismIO.connection
function Link () {
  Duplex.call(this, {allowHalfOpen: false, objectMode: true})

  this.on('error', function(er) {
    console.warn('Error in link', 'undefined'==typeof process? er : er.stack || er)
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
 * Please, Don't send edits with this method! Use .sendEdit() to queue it, like everyone else.
 */
Link.prototype.send = function(event/*, args..*/) {
  var data = JSON.stringify(Array.prototype.slice.call(arguments))
  console.log('->', data)
  //console.trace()

  this.push(data)
}

/*
 * Put an edit into the queue
 * @param edit {Edit} the edit to send through this link
 * @param cb {Function} Get callback when the edit has been acknowledged (optional)
 */
Link.prototype.sendEdit = function(edit, cb) {
  if(cb) this.callback = cb

  if(this.queue.length || this.sentEdit) {
    this.queue.push(edit)
  }
  else {
    this.sentEdit = edit
    this.send('edit', edit.pack())
  }
}

// This is only used to push edits from the queue into the pipeline.
// All other events are pushed directly in .send()
Link.prototype._read = function() {
  if(!this.queue[0]) return
  if(this.sentEdit) return

  this.sentEdit = this.queue.unshift()
  this.send('edit', this.sentEdit.pack())
}

Link.prototype._write = function(buf, enc, cb) {
  console.log('<- _write:', buf.toString(enc))
  var args = JSON.parse(buf.toString(enc))

  // Intercept acks for shifting the queue and calling callbacks
  if(args[0] == 'ack') {

    this.sentEdit = null
    if(this.callback) {
      nextTick(this.callback.bind(null, null, args[1]))
    }
  }

  args[0] = 'link:'+args[0]
  this.emit.apply(this, args)
  cb()
}
