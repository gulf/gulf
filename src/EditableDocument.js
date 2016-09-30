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
var co = require('co')
var Document = require('./Document')
  , Revision = require('./Revision')

function EditableDocument() {
  this.initialized = false
  Document.apply(this, arguments)
}

module.exports = EditableDocument

EditableDocument.prototype = Object.create(Document.prototype, { constructor: { value: EditableDocument }})

// overrides Document#attachSlaveLink
EditableDocument.prototype.attachSlaveLink = function() {
  // EditableDocuments can only have a master link! Nothing else, because we
  // need to take care of our own edits here, which are live!
  // -- we don't want to mess with other docs' edits!
  throw new Error('You can\'t attach a slave to an editable document!')
}

// overrides Document#receiveInit
EditableDocument.prototype.receiveInit = co.wrap(function*(data, fromLink) {
  debug('EditableDocument#receiveInit', data)
  var initialRev = Revision.fromJSON(data, this.ottype)

  this.master.reset()
  this.content = initialRev.content

  yield this.storage.storeRevision(initialRev)

  try {
    yield this._setContent(this.content)
  }catch(er) {
    this.emit('error', er)
    return
  }
  
  this.initialized = true
  this.emit('init')
})

/**
 * submitChange is called when a modification has been made
 *
 * @param cs A changeset that can be swallowed by the ottype
 */
EditableDocument.prototype.submitChange = co.wrap(function*(cs, meta) {
  if(null === this.content) throw new Error('Document has not been initialized')

  const edit = Revision.newFromChangeset(cs, this.ottype)
  edit.meta = meta
 
  try {
    var lastRevId = yield this.storage.getLastRevisionId()
  }catch(e) {
    this.emit('error', e)
    throw e
  }

  edit.parent = lastRevId

  this.emit('submit', edit)

  // Merge into the queue for increased collab speed
  if(this.options.mergeQueue && this.master.queue.length && 'edit' === this.master.queue[this.master.queue.length-1][0]) {
    var pendingEdit = this.master.queue.pop()[1]
      , parent = pendingEdit.parent
      , callback = pendingEdit.callback
    pendingEdit = pendingEdit.merge(edit)
    pendingEdit.callback = callback
    pendingEdit.parent = parent
    this.master.queue.push(['edit', pendingEdit])
    return
  }

  const committedEdit = yield this.master.sendEdit(edit)
  
  // Update queue
  this.master.queue.forEach(function(pending) {
    if('edit' === pending[0]) {
      pending[1].parent = committedEdit.id
    }
  })
  
  try {
    yield this.applyEdit(committedEdit, true)
  }catch(e) {
    this.master.emit('editError', e)
    throw e
  }
  
  committedEdit.content = this.content
  
  try {
    yield this.storage.storeRevision(committedEdit.toJSON(true))  
  }catch(e) {
    this.emit('error', e)
    throw e
  }
  
  this.emit('commit', committedEdit, /*ownEdit:*/true)
})

// overrides Document#applyEdit
EditableDocument.prototype.applyEdit = co.wrap(function*(edit, ownEdit) {
  // apply changes
  debug('EditableDocument#applyEdit', edit, ownEdit)
  try {
    this.content = edit.apply(this.content)

    // Very important! Bail early. Pending edits have been updated in submitChange()
    if(ownEdit) return
    
    // Collect undetected local changes, before applying the new edit
    yield this._onBeforeChange()
    
    // Transform against possibly missed edits that have happened in the meantime,
    // so that we can apply it

    var incoming = edit
      , incomingOriginal

    if(this.master.sentEdit) {
      incomingOriginal = incoming.clone()
      incoming.transformAgainst(this.master.sentEdit, true)
      this.master.sentEdit.follow(incomingOriginal) // Why? So that our history is correct!
    }

    incomingOriginal = incoming.clone()

    // transform incoming against pending
    this.master.queue.forEach(function(pending) {
      if('edit' === pending[0]) incoming.transformAgainst(pending[1], true)
    })

    // Transform pending edits against the incoming one
    var first = true
    this.master.queue.forEach(function(pending) {
      if(pending[0] !== 'edit') return
      var pendingEdit = pending[1]
      if(first) {
        pendingEdit.follow(incomingOriginal) // transform + adjust parentage for the first in the line
        first = false
      }
      else {
        pendingEdit.transformAgainst(incomingOriginal) // all others have their predecessors as parents
      }

      incomingOriginal.transformAgainst(pendingEdit)
    })

    yield this._onChange(incoming.changeset)
  }catch(e) {
    e.message = 'Applying edit failed: '+e.message
    throw e
  }
})

EditableDocument.prototype._onBeforeChange = function() {
  throw new Error('Not implemented! You need to implement this method!')
}
EditableDocument.prototype._onChange = function() {
  throw new Error('Not implemented! You need to implement this method!')
}
EditableDocument.prototype._setContent = function() {
  throw new Error('Not implemented! You need to implement this method!')
}
