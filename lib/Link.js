/**
 * gulf - Sync anything!
 * Copyright (C) 2013-2015 Marcel Klehr <mklehr@gmx.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var Duplex = require('stream').Duplex
require('setimmediate')


/**
 * This is a Link
 * The public should interact with it via node's streams API (ie. using .pipe etc.)
 * Internally, it emits events ("link:*") that are picked up by the Document it is attached to.
 */

// XX Must have the same terminology of #awaitingAck and #sent as prismIO.connection
function Link () {
  this.credentials
  this.authorizeFn
  this.sentEdit
  this.queue
  this.callbacks

  Duplex.call(this, {allowHalfOpen: false, objectMode: true})

  this.on('error', function(er) {
    console.warn('Error in link', 'undefined'!=typeof window? er : er.stack || er)
  }.bind(this))
  
  this.on('editError', function(er) {
    console.warn('EditError in link', 'undefined'!=typeof window? er : er.stack || er)
  })

  this.reset()
}
Link.prototype = Object.create(Duplex.prototype, { constructor: { value: Link }})

module.exports = Link

Link.prototype.reset = function() {
  this.queue = []
  this.sentEdit = null
  this.callbacks = {}
}

/**
 * Pipeline an event
 * Please, Don't send edits with this method! Use .sendEdit() to queue it, like everyone else.
 */
Link.prototype.send = function(event/*, args..*/) {
  var data = JSON.stringify(Array.prototype.slice.call(arguments).concat([this.credentials]))
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
  if(cb) edit.callback = cb

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
  if(this.sentEdit) return
  if(!this.queue[0]) return
  this.sentEdit = this.queue.shift()
  this.send('edit', this.sentEdit.pack())
}

Link.prototype._write = function(buf, enc, cb) {
  console.log('<- _write:', buf.toString())
  var args = JSON.parse(buf.toString())

  this.authorize(args, args[args.length-1], function(er, authorized) {

    if(er) this.emit('error', er)
    if(!authorized) return

    // Intercept acks for shifting the queue and calling callbacks
    if(args[0] == 'ack') {
      var id = args[1]

      if(this.sentEdit && this.sentEdit.callback) {
        // Callback
        this.sentEdit.id = id
        // The nextTick shim for browsers doesn't seem to enforce the call order
        // (_read is called below and they must be in that order), so we call directly
        //nextTick(this.sentEdit.callback.bind(null, null, this.sentEdit))
        try {
          this.sentEdit.callback(null, this.sentEdit)
        }catch(e) {
          this.emit('error', e)
        }
        delete this.sentEdit.callback
      }
      this.sentEdit = null

      setImmediate(function() {
        this._read(0)
      }.bind(this))
    }

    args[0] = 'link:'+args[0]
    this.emit.apply(this, args)
    cb()
  }.bind(this))
}

Link.prototype.authorize = function(msg, credentials, cb) {
  if(!this.authorizeFn) return cb(null, true)
  this.authorizeFn(msg, credentials, cb)
}
