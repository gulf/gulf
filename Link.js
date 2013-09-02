var Duplex = require('stream').Duplex
  , EventEmitter = require('events').EventEmitter

// uses nodeJS streams API on the public facing side
// and events for ack, edit, etc. internally (listened on by Document; namespace: 'link:')
// additional events on link: error

// XX Must have the same terminology of #awaitingAck and #sent as prismIO.connection
function Link () {
  Duplex.call(this, {allowHalfOpen: false})

  this.on('error', function(er) {
    console.warn('Error in link', er.stack || er)
    this.end()
    // i dunno what to do here...
  }.bind(this))
}
Link.prototype = Object.create(Duplex.prototype, { constructor: { value: Link }})

module.exports = Link

Link.prototype.send = function(/*event, args..*/) {
  //console.log('->', arguments)
  // XXX Push to queue here waiting on ack!
  this.push(JSON.stringify(Array.prototype.slice.call(arguments)))
}

Link.prototype._read = function() {
 // Unnecessary, we make data available (readable/pipable) when omeone calls Link#send
 // XXX We should actually implement aour own queue (s. EditableDocument)
}

Link.prototype._write = function(buf, enc, cb) {
  //console.log('<- _write:', buf.toString(enc))
  // XXX Don't perform any transformations here!! Just intercept acks for shifting the queue
  var args = JSON.parse(buf.toString(enc))
  args[0] = 'link:'+args[0]
  this.emit.apply(this, args)
  cb()
}