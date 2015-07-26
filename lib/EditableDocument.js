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
var Document = require('./Document')
  , Edit = require('./Edit')

function EditableDocument() {
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
EditableDocument.prototype.receiveInit = function(data, fromLink) {
  this._change(Document.prototype.receiveInit.call(this, data, fromLink))
}

/**
 * Update is called when a modification has been made
 *
 * @param cs A changeset that can be swallowed by the ottype
 */
EditableDocument.prototype.update = function(cs) {
  if(null === this.content) throw new Error('Document has not been initialized')

  var edit = Edit.newFromChangeset(cs, this.ottype)
  
  this.history.latest(function(er, latestSnapshot) {
    if(er) throw er

    edit.parent = latestSnapshot.edit.id
  
    // Merge into the queue for increased collab speed
    if(false && this.master.queue.length == 1) {
      var parent = this.master.queue[0].parent
        , callback =this.master.queue[0].callback
      this.master.queue[0] = this.master.queue[0].merge(edit)
      this.master.queue[0].callback = callback
      this.master.queue[0].parent = parent
      return
    }

    this.master.sendEdit(edit, function onack(err, edit) {
      // Update queue
      this.master.queue.forEach(function(queuedEdit) {
        queuedEdit.parent = edit.id
      })
      this.applyEdit(edit, true)
      //this.distributeEdit(edit) // Unnecessary round trip
      this.history.storeSnapshot({contents: this.content, edit: edit})
    }.bind(this))
  }.bind(this))
}

// overrides Document#sanitizeEdit
EditableDocument.prototype.sanitizeEdit = function(incoming, fromLink, cb) {
  // Collect undetected local changes, before applying the new edit
  this._collectChanges()

  // Transform against possibly missed edits that have happened in the meantime,
  // so that we can apply it

  var incomingOriginal

  if(this.master.sentEdit) {
    incomingOriginal = incoming.clone()
    incoming.transformAgainst(this.master.sentEdit)
    this.master.sentEdit.follow(incomingOriginal) // Why!?
  }

  incomingOriginal = incoming.clone()

  // transform incoming against pending
  this.master.queue.forEach(function(pendingEdit) {
    incoming.transfromAgainst(pendingEdit)
  })

  // Transform pending edits against the incoming one
  this.master.queue.forEach(function(pendingEdit, i) {
    if(i === 0) {
      pendingEdit.follow(incomingOriginal) // transform + adjust parentage for the first in the line
    }
    else {
      pendingEdit.transformAgainst(incomingOriginal) // all others have their predecessors as parents
    }

    incomingOriginal.transformAgainst(pendingEdit)
  })

  cb(null, incoming)
}

// overrides Document#applyEdit
EditableDocument.prototype.applyEdit = function(edit, ownEdit) {
  // apply changes
  console.log('EditableDocument: apply edit', edit, ownEdit)
  try {
    this.content = edit.apply(this.content)
    if(!ownEdit) this._change(this.content, edit.changeset)
  }catch(e) {
    e.message = 'Applying edit failed: '+e.message
    throw e
  }
}
