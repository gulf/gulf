/**
 * gulf - Sync anything!
 * Copyright (C) 2013-2015 Marcel Klehr <mklehr@gmx.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var Link = require('./Link')
  , Edit = require('./Edit')
  , History = require('./History')
  , queue = require('queue')
  , EventEmitter = require('events').EventEmitter

function Document(adapter, ottype) {
  EventEmitter.apply(this)
  this.id
  this.adapter = adapter
  this.ottype = ottype

  this.content = null
  this.history = new History(this)
  this.initialized = false

  this.slaves = []
  this.links = []
  this.master = null

  this.queue = queue()
  this.queue.concurrency = 1
  this.queue.start()

  if(!this.ottype) throw new Error('Document: No ottype specified')
  if(!this.adapter) throw new Error('Document: No adapter specified')
}

module.exports = Document

Document.prototype = Object.create(EventEmitter.prototype, { constructor: { value: Document }})

/**
 * Creates a new document
 */
Document.create = function(adapter, ottype, content, cb) {
  var doc = new Document(adapter, ottype)
  doc.history.createDocument({
    contents: ottype.serialize? ottype.serialize(content) : content
  , edit: Edit.newInitial(ottype)
  }, function(er, id) {
    if(er) return cb(er)
    doc.initialized = true
    doc.content = content
    doc.id = id
    doc.emit('init')
    cb(null, doc)
  })
  return doc
}

Document.load = function(adapter, ottype, id, cb) {
  var doc = new Document(adapter, ottype)
  doc.adapter.getLatestSnapshot(id, function(er, snapshot) {
    if(er) return cb(er)
    doc.initialized = true
    doc.content = ottype.deserialize?
      ottype.deserialize(snapshot.contents)
    : snapshot.contents
    doc.id = id
    doc.emit('init')
    cb(null, doc)
  })
  return doc
}

/**
 * Creates a new Link and attaches it as a slave
 * @param opts Options to be passed to Link constructor
 */
Document.prototype.slaveLink = function(opts) {
  var link = new Link(opts)
  this.attachSlaveLink(link)
  return link
}

/**
 * Creates a new Link and attaches it as master
 * (You will want to listen to the link's 'close' event)
 * @param opts Options to be passed to Link constructor
 */
Document.prototype.masterLink = function(opts) {
  var link = new Link(opts)
  this.attachMasterLink(link)
  return link
}

// XXX Detach link!

/**
 * Attaches a link as master
 */
Document.prototype.attachMasterLink = function(link) {
  this.master = link
  this.attachLink(link)

  link.on('editError', function() {
    link.send('requestInit')
  }.bind(this))

  link.on('close', function() {
    this.master = null
  }.bind(this))
}

/**
 * Attaches a link as a slave
 */
Document.prototype.attachSlaveLink = function(link) {
  this.slaves.push(link)
  this.attachLink(link)

  link.on('editError', function() {
    this.history.latest(function(er, latest) {
      if(er) return this.emit('error', er)
      var content = (this.ottype.serialize)? this.ottype.serialize(this.content) : this.content
      link.send('init', {contents: content, edit: latest.edit.pack()})
    }.bind(this))
  }.bind(this))

  link.on('close', function onclose() {
    this.slaves.splice(this.slaves.indexOf(link), 1)
  }.bind(this))
}

Document.prototype.attachLink = function(link) {
  if(~this.links.indexOf(link)) return;

  this.links.push(link)

  // Other end requests init? can do.
  link.on('link:requestInit', function() {
    this.receiveRequestInit(link)
  }.bind(this))

  // Other side sends init.
  link.on('link:init', function(data) {
    this.receiveInit(data, link)
  }.bind(this))

  link.on('link:requestHistorySince', function(since) {
    this.receiveRequestHistorySince(since, link)
  }.bind(this))

  // Other side sends edit.
  link.on('link:edit', function onedit(edit) {
    this.receiveEdit(edit, link.authenticated, link)
  }.bind(this))

  link.on('close', function onclose() {
    this.links.splice(this.links.indexOf(link), 1)
  }.bind(this))

  // If we don't know the document yet, request its content
  if(null === this.content) link.send('requestInit')
}

Document.prototype.receiveRequestInit = function(link) {
  if(!this.initialized) {
    return this.once('init', function() {
      this.receiveRequestInit(link)
    }.bind(this))
  }
  this.history.latest(function(er, latest) {
    if(er) return this.emit('error', er)
    var content = (this.ottype.serialize)? this.ottype.serialize(this.content) : this.content
    link.send('init', {contents: content, edit: latest.edit.pack()})
  }.bind(this))
}

/**
 * Receive init
 *
 * @param data {Object} Example: {contents: "", edit: <Edit..>}
 * @param fromLink
 */
Document.prototype.receiveInit = function(data, fromLink) {
  // I'm master? Don't go bossing me around!
  if(!this.master || fromLink !== this.master) return

  var content = data.contents
    , initialEdit = data.edit

  if(this.ottype.deserialize) {
    content = this.ottype.deserialize(content)
  }

  initialEdit = Edit.unpack(initialEdit, this.ottype)

  this.links.forEach(function(link) { link.reset() })
  this.content = content

  this.history.reset()
  this.history.storeSnapshot({id: initialEdit.id, contents: data.contents, edit: initialEdit}, function() {
    // I got an init, so my slaves get one, too
    this.slaves.forEach(function(slave) {
      slave.send('init', data)
    })
  }.bind(this))

  this.initialized = true
  this.emit('init')

  return content
}

/**
 * Receive a requestHistorySince message
 *
 * @param sinceEditId String The last known edit id by the slave
 * @param fromLink
 */
Document.prototype.receiveRequestHistorySince = function(sinceEditId, fromLink) {
  // Check to see if we know that edit
  this.history.remembers(sinceEditId, function(er, remembersEdit) {
    if(er) return this.emit('error', er)

    if(!remembersEdit) {
      // Sorry pal.
      // XXX: Maybe we should send an 'init' here?
      return
    }

    this.history.getAllAfter(sinceEditId, function(er, snapshots) {
      if(er) return this.emit('error', er)

      fromLink.reset()

      snapshots
      .map(function(s) {
        return s.edit
      })
      .forEach(fromLink.sendEdit.bind(fromLink))
    }.bind(this))

  }.bind(this))
}

/**
 * Receive an edit
 *
 * @param edit <Edit>
 * @paramfromLink <Link>
 */
Document.prototype.receiveEdit = function(edit, author, fromLink, callback) {
  console.log('receiveEdit', edit)
  edit = Edit.unpack(edit, this.ottype)
  if (!this.master || fromLink === this.master) {
    // Edit comes from master, or even better: we are master, yea baby!
    this.queue.push(function(cb) {
      this.dispatchEdit(edit, author, fromLink, function(er, edit) {
        cb()
        callback && callback(er, edit)
      })
    }.bind(this))
    this.queue.start()
  }else {
    // check with master first
    this.master.sendEdit(edit, function onack(err, edit) {
      this.queue.push(function(cb) {
        this.dispatchEdit(edit, author,fromLink, function(er, edit) {
          cb()
          callback && callback(er, edit)
        })
      }.bind(this))
      this.queue.start()
    }.bind(this))
  }
}

/**
 * Dispatch a received edit
 *
 * @param edit <Edit>
 * @param fromLink <Link> (optional>
 */
Document.prototype.dispatchEdit = function(edit, author, fromLink, cb) {

  // Also check if this might be sentEdit, cause if we've requested History, then
  // the other side has reset their queue and thus destroyed all acks.
  // So, fromLink.sentEdit might have been accepted, but we might not havw got the ACK
  if(fromLink&& fromLink.sentEdit && fromLink.sentEdit.id === edit.id) {
    fromLink.sentEdit.callback(null, fromLink.sentEdit)
    fromLink.sentEdit = null
    setImmediate(function() {
      fromLink._read(0)
    })
    cb()
    return
  }

  this.history.remembers(edit.id, function(er, remembers) {
    if(er) return this.emit('error',er)

    if (remembers) {
      // We've got this edit already.

      // If I'm master then we need to queue the ack
      // Slaves have to send it straight away
      if(fromLink === this.master) fromLink.send('ack' ,edit.id)
      else if (fromLink) fromLink.sendAck(edit.id)

      return cb(null, edit)
    }

    // Check integrity of this edit
    this.history.remembers(edit.parent, function(er, remembersParent) {
      if (!remembersParent) {
        if(fromLink === this.master) {
          // we probably missed some edits, let's ask master!
          this.history.latest(function(er, latestSnapshot) {
            if(er) return this.emit('error', er)
            this.master.send('requestHistorySince', latestSnapshot.edit.id)
          }.bind(this))
          return cb()
        }else {
          // I'm master, I can't have missed that edit. So, throw and re-init!
          var e = new Error('Edit "'+edit.id+'" has unknown parent "'+edit.parent+'"')
          fromLink && fromLink.emit('editError', e)
          return cb(e)
        }
      }


      this.sanitizeEdit(edit, fromLink, function apply(er, edit) {
        if(er) {
          fromLink && fromLink.emit('editError', er)
          return cb(er)
        }

        // EditableDocuments are initialized asynchronously, we have to wait
        // for their callback event...
        if(!this.initialized) {
          this.once('editableInitialized', apply.bind(this, null, edit))
          return
        }

        this.applyEdit(edit, false, function(er) {
          if(er) {
            fromLink && fromLink.emit('editError', er)
            return cb(er)
          }

          // add to history
          var content = this.ottype.serialize?
            this.ottype.serialize(this.content)
          : this.content
          this.history.storeSnapshot({
            id: edit.id
          , contents: content
          , edit: edit
          , author: author
          }, function(er) {
            if(er) {
              this.emit('error', er)
              return cb(er)
            }

            // If I'm master then we need to queue the ack
            // Slaves have to send it straight away
            if(fromLink && fromLink === this.master) fromLink.send('ack' ,edit.id)
            else if (fromLink) fromLink.sendAck(edit.id)

            this.distributeEdit(edit, fromLink)
            this.emit('edit', edit)
            cb(null, edit)

          }.bind(this))
        }.bind(this))
      }.bind(this))
    }.bind(this))
  }.bind(this))
}

/**
 * Returns an edit that is able to be applied
 */
Document.prototype.sanitizeEdit = function(edit, fromLink, cb) {

  if(this.master === fromLink) {
    // We are not allowed to apply anything without consent from master anyway,
    // so we don't need to transform anything coming from master.
    cb(null, edit)
  }else {
    // We are master!

    // Transform against missed edits from history that have happened in the meantime
    this.history.getAllAfter(edit.parent, function(er, missed) {
      if(er) return cb(er)

      try {
        missed.forEach(function(oldSnapshot) {
          try {
            edit.follow(oldSnapshot.edit)
          }catch(e) {
            e.message = 'Transforming '+edit.id+' against '+oldSnapshot.edit.id+' failed: '+e.message
            throw e
          }
        })
      }catch(e) {
        cb(e)
        return
      }

      if(missed.length > 10) {
        // this one apparently missed a lot of edits, looks like this is a reconnect
        missed.forEach(function(oldSnapshot) {
          fromLink.send('edit', oldSnapshot.edit)
        })
      }

      cb(null, edit)
    }.bind(this))
  }
}

Document.prototype.applyEdit = function(edit, ownEdit, cb) {
  // apply changes
  console.log('Document: apply edit', edit)
  try {
    this.content = edit.apply(this.content)
    cb()
  }catch(e) {
    e.message = 'Applying edit failed: '+e.message
    cb(e)
  }
}

Document.prototype.distributeEdit = function(edit, fromLink) {
  // forward edit
  this.links.forEach(function(link) {
    if(link === fromLink) return
    if(link === this.master) return

    link.sendEdit(edit)
  }.bind(this))
}
