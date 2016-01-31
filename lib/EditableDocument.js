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
var Document = require('./Document')
  , Edit = require('./Edit')

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
EditableDocument.prototype.receiveInit = function(data, fromLink) {
  var content = Document.prototype.receiveInit.call(this, data, fromLink)
  this.initialized = false
  this._setContents(content, function(er) {
    if(er) return this.emit('error', er)
    this.initialized = true
    this.emit('editableInitialized')
  }.bind(this))
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

    this.emit('update', edit)

    // Merge into the queue for increased collab speed
    if(this.master.queue.length && 'edit' === this.master.queue[this.master.queue.length-1][0]) {
      var pendingEdit = this.master.queue.pop()[1]
        , parent = pendingEdit.parent
        , callback = pendingEdit.callback
      pendingEdit = pendingEdit.merge(edit)
      pendingEdit.callback = callback
      pendingEdit.parent = parent
      this.master.queue.push(['edit', pendingEdit])
      return
    }

    this.master.sendEdit(edit, function onack(err, edit) {
      // Update queue
      this.master.queue.forEach(function(pending) {
        if('edit' === pending[0]) {
          pending[1].parent = edit.id
        }
      })
      this.applyEdit(edit, true, function() {
        //this.distributeEdit(edit) // Unnecessary round trip
        this.history.storeSnapshot({contents: this.content, edit: edit})
      }.bind(this))
    }.bind(this))
  }.bind(this))
}

// overrides Document#applyEdit
EditableDocument.prototype.applyEdit = function(edit, ownEdit, cb) {
  // apply changes
  console.log('EditableDocument: apply edit', edit, ownEdit)
  try {
    this.content = edit.apply(this.content)

    if(!ownEdit) {
      // Collect undetected local changes, before applying the new edit
      this._collectChanges(function(er) {
        if(er) return cb(er)

        // Transform against possibly missed edits that have happened in the meantime,
        // so that we can apply it

        var incoming = edit
          , incomingOriginal

        if(this.master.sentEdit) {
          incomingOriginal = incoming.clone()
          incoming.transformAgainst(this.master.sentEdit, true)
          this.master.sentEdit.follow(incomingOriginal) // Why!? So that our history is correct
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
        this._change(incoming.changeset, cb)
      }.bind(this))
    }else{
      cb()
    }
  }catch(e) {
    e.message = 'Applying edit failed: '+e.message
    cb(e)
  }
}
