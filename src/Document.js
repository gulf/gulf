/**
 * gulf - Sync anything!
 * Copyright (C) 2013-2016 Marcel Klehr <mklehr@gmx.net>
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
var debug = require('debug')('gulf')
var Link = require('./Link')
  , Revision = require('./Revision')
  , MemoryAdapter = require('./MemoryAdapter')
  , queue = require('queue')
  , EventEmitter = require('events').EventEmitter
  , co = require('co')

function Document(options) {
  EventEmitter.apply(this)
  this.id
  this.options = {
    mergeQueue: true
  , storageAdapter: new MemoryAdapter
  }
  for (var prop in options) this.options[prop] = options[prop]
  this.storage = this.options.storageAdapter 
  this.ottype = this.options.ottype

  this.content = null
  this.initialized = false

  this.slaves = []
  this.links = []
  this.master = null

  this.queue = queue()
  this.queue.concurrency = 1
  this.queue.start()

  if(!this.ottype) throw new Error('Document: No ottype specified')
  if(!this.storage) throw new Error('Document: No adapter specified')
  this.on('error', console.log)
}

module.exports = Document

Document.prototype = Object.create(EventEmitter.prototype, { constructor: { value: Document }})

/**
 * Load an existing document
 * @returns Promise
 */
Document.prototype.initializeFromStorage = co.wrap(function*(defaultContent) {
  var revId, rev
  try {
    revId = yield this.storage.getLastRevisionId()
  }catch(e) {}
  if ('number' !== typeof revId) {
    rev = Revision.newInitial(this.ottype, defaultContent)
    yield this.storage.storeRevision(rev)
  }else{
    var rev = yield this.storage.getRevision(revId)
  }
  this.initialized = true
  this.content = rev.content
  this.emit('init')
})

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

/**
 * Attaches a link as master
 */
Document.prototype.attachMasterLink = function(link) {
  this.master = link
  this.attachLink(link)

  link.on('editError', () => {
    link.send('requestInit')
  })

  link.on('finish', () => {
    this.master = null
  })
}

/**
 * Attaches a link as a slave
 */
Document.prototype.attachSlaveLink = function(link) {
  this.slaves.push(link)
  this.attachLink(link)

  link.on('editError', () => {
    this.receiveRequestInit(link)
    .catch(e => this.emit('error', e))
  })

  link.on('finish', () => {
    this.slaves.splice(this.slaves.indexOf(link), 1)
  })
}

Document.prototype.attachLink = function(link) {
  if(~this.links.indexOf(link)) return;

  this.links.push(link)

  // Other end requests init? can do.
  link.on('link:requestInit', () => {
    this.receiveRequestInit(link)
    .catch((e) => this.emit('error', e))
  })

  // Other side sends init.
  link.on('link:init', (data) => {
    this.receiveInit(data, link)
    .catch((e) => this.emit('error', e))
  })

  link.on('link:requestHistorySince', (since) => {
    this.receiveRequestHistorySince(since, link)
    .catch((e) => this.emit('error', e))
  })

  // Other side sends edit.
  link.on('link:edit', (edit) => {
    this.receiveEdit(edit, link.authenticated, link)
    .catch((e) => this.emit('error', e))
  })
 
  link.on('finish', () => {
    this.detachLink(link)
  })

  // If we don't know the document yet, request its content
  if(null === this.content) link.send('requestInit')
}

Document.prototype.detachLink = function(link) {
  var idx
  if(!~(idx = this.links.indexOf(link))) return;
  this.links.splice(idx, 1)
  link.reset()
}

Document.prototype.close = function() {
  this.links.forEach(function(l) {
    l.reset()
  })
  this.links = []
  this.master = null
  this.slaves = []
}

Document.prototype.receiveRequestInit = co.wrap(function*(link) {
  debug('receiveRequestInit')
  if(!this.initialized) {
    yield (cb) => this.once('init', cb)
  }
  const latestId = yield this.storage.getLastRevisionId()
  const latest = yield this.storage.getRevision(latestId)

  link.send('init', latest) // We skip toJSON(fromJSON(x))
})

/**
 * Receive init
 *
 * @param data {Object} (Serialized Revision with content)
 * @param fromLink
 */
Document.prototype.receiveInit = co.wrap(function*(data, fromLink) {
  debug('receiveInit', data)
  // I'm master? Don't go bossing me around!
  if(!this.master || fromLink !== this.master) return

  var initialRev = Revision.fromJSON(data, this.ottype)

  this.links.forEach(link => link.reset())
  this.content = initialRev.content

  yield this.storage.storeRevision(initialRev.toJSON(true))
  
  // I got an init, so my slaves get one, too
  this.slaves.forEach(function(slave) {
    slave.send('init', data)
  })

  this.initialized = true
  this.emit('init')
})

/**
 * Receive a requestHistorySince message
 *
 * @param sinceEditId String The last known edit id by the slave
 * @param fromLink
 */
Document.prototype.receiveRequestHistorySince = co.wrap(function*(sinceEditId, fromLink) {
  fromLink.reset()
  (yield this.getRevisionsAfter(sinceEditId))
  .map((r) => Revision.fromJSON(r, this.ottype))
  .forEach((rev) => fromLink.sendEdit(rev))
})

/**
 * Get all revisions after x
 * @param x the id of the edit after which edits are collected
 * @returns Promise<Array<Revision>>
 */
Document.prototype.getRevisionsAfter = co.wrap(function*(afterId){
  const lastId = yield this.storage.getLastRevisionId()
  const requestIds = []
  for (var i=afterId+1; i <= lastId; i++) requestIds.push(i)
  
  return (yield requestIds.map((id) => this.storage.getRevision(id)))
  .map((rev) => Revision.fromJSON(rev, this.ottype))
})

/**
 * Receive an edit
 *
 * @param edit <Edit>
 * @paramfromLink <Link>
 */
Document.prototype.receiveEdit = co.wrap(function*(edit, author, fromLink) {
  debug('receiveEdit', edit)
  
  edit = Revision.fromJSON(edit, this.ottype)
  edit.author = author

  if (this.master && fromLink !== this.master) {
    // check with master first
    yield this.master.sendEdit(edit)
  }

  const queueCb = yield (resolve) => {
    this.queue.push((cb) => resolve(null, cb))
    this.queue.start()
  }
 
  try {
    yield this.dispatchEdit(edit, fromLink)
  }catch(er) {
    this.emit('error', er)
  }
  queueCb()
})

/**
 * Dispatch a received edit
 *
 * @param edit <Edit>
 * @param fromLink <Link> (optional>
 */
Document.prototype.dispatchEdit = co.wrap(function*(edit, fromLink) {
  // Check if this might be sentEdit, cause if we've requested History, then
  // the other side has reset their queue and thus destroyed all acks.
  // So, fromLink.sentEdit might have been accepted, but we might not have got the ACK
  if(fromLink&& fromLink.sentEdit && fromLink.sentEdit.id === edit.id) {
    fromLink.sentEdit.callback(null, fromLink.sentEdit)
    fromLink.sentEdit = null
    setImmediate(function() {
      fromLink._read(0)
    })
    return
  }
  
  if(!this.initialized) {
    yield (cb) => this.once('init', () => cb())
  }

  const lastRevId = yield this.storage.getLastRevisionId()

  if (edit.parent > lastRevId) {
    if(fromLink === this.master) {
      // we probably missed some edits, let's ask master!
      this.master.send('requestHistorySince', lastRevId)
      return // We drop the edit
    }else {
      // I'm master, I can't have missed that edit. So, throw and re-init!
      fromLink && fromLink.emit('editError', new Error('Edit "'+edit.id+'" has unknown parent "'+edit.parent+'"'))
      return
    }
  }

  try { 
    yield this.sanitizeEdit(edit, fromLink)
    yield this.applyEdit(edit, /*ownEdit*/false)
  }catch(e) {
    fromLink && fromLink.emit('editError', e)
    return
  }

  // add to history
  edit.id = lastRevId+1
  edit.content = this.content
  yield this.storage.storeRevision(edit.toJSON(true))

  // If I'm master then we need to queue the ack
  // Slaves have to send it straight away
  if(fromLink === this.master) fromLink.send('ack', edit.id)
  else if (fromLink) fromLink.sendAck(edit.id)
  
  this.distributeEdit(edit, fromLink)
  this.emit('commit', edit, /*ownEdit:*/false)  
})

/**
 * Returns an edit that is able to be applied
 */
Document.prototype.sanitizeEdit = co.wrap(function*(edit, fromLink, cb) {

  if(this.master === fromLink) {
    // We are not allowed to apply anything without consent from master anyway,
    // so we don't need to transform anything coming from master.
    return
  }else {
    // We are master!

    // Transform against missed edits from history that have happened in the meantime 
    const missed = yield this.getRevisionsAfter(edit.parent)

    missed
    .forEach((oldRev) => {
      try {
        debug('sanitize', 'transform', edit, oldRev)
        edit.follow(oldRev)
      }catch(e) {
        e.message = 'Transforming edit against '+oldRev.id+' failed: '+e.message
        throw e
      }
    })

    if(missed.length > 10) {
      // this one apparently missed a lot of edits, looks like this is a reconnect
      // -> send 'em our stash
      missed
      .forEach((oldRev) => {
        fromLink.send('edit', oldRev)
      })
    }
  }
})

Document.prototype.applyEdit = function(edit, ownEdit) {
  // apply changes
  debug('Document: apply edit', edit)
  try {
    this.content = edit.apply(this.content)
    return Promise.resolve()
  }catch(e) {
    e.message = 'Applying edit failed: '+e.message
    return Promise.reject(e)
  }
}

Document.prototype.distributeEdit = function(edit, fromLink) {
  // forward edit
  this.links.forEach((link) => {
    if(link === fromLink) return
    if(link === this.master) return

    link.sendEdit(edit)
  })
}
