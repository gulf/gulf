var Duplex = require('stream').Duplex
  , EventEmitter = require('events').EventEmitter

// uses nodeJS streams API on the public facing side
// and events for ack, edit, etc. internally (listened on by Document; link#ev)
// additional events on link: error

// XX Must have the same terminology of #awaitingAck and #sent as prismIO.connection
function Link () {
  Duplex.call(this, {allowHalfOpen: false})

  this.on('error', function(er) {
    console.warn('Error in link', er.stack || er)
    this.end()
    // i dunno what to do here...
  }.bind(this))

  this.ev = new EventEmitter
  EventEmitter.call(this.ev)
}
Link.prototype = Object.create(Duplex.prototype, { constructor: { value: Link }})

module.exports = Link

Link.prototype.send = function() {
  //console.log('->', arguments)
  // XXX Push to queue here waiting on ack!
  this.push(JSON.stringify(Array.prototype.slice.call(arguments)))
}

Link.prototype._read = function() {

}

Link.prototype._write = function(buf, enc, cb) {
  //console.log('<- _write:', buf.toString(enc))
  // XXX Don't perform any transformations here!! Just intercept acks for shifting the queue
  this.ev.emit.apply(this.ev, JSON.parse(buf.toString(enc)))
  cb()
}