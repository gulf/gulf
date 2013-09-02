var Document = require('./Document')
  , Edit = require('./Edit')
  , changesets = require('changesets').text

// XXX Must have a master link! (Why?)
function EditableDocument() {
  Document.call(this)
}

module.exports = EditableDocument

EditableDocument.prototype = Object.create(Document.prototype, { constructor: { value: EditableDocument }})

EditableDocument.prototype.update = function() {
  if(null === this.content) return

  var cs = changesets.constructChangeset(this.content, this._getContent())// XXX Abstract this -- only allows for text!
  if(!cs.length) return
  
  this.content = this._getContent()

  var edit = Edit.newFromChangeset(cs)
  edit.parent = this.history.latest().id

  if(!this.masterLink) {
    this.distributeEdit(edit)
    this.history.pushEdit(edit)
  } else {
    this.masterLink.send('edit', edit.pack())
    this.masterLink.ev.on('ack', function onack(id) {
      if(id == edit.id) {
        this.distributeEdit(edit)
        this.history.pushEdit(edit)
        this.masterLink.ev.removeListener('ack', onack)
      }
    }.bind(this))
  }
}

// overrides Document#applyEdit
EditableDocument.prototype.applyEdit = function(edit, fromLink) {
  // if there's a master link, Link#update waits for the master to acknoledge the new edits
  // else it pushes them to history directly, which means we can just transform against history
  this.update()
  
  if(!this.masterLink) {
    // apply to shadowCopy and send ack and distribute edit
    Document.prototype.applyEdit.call(this, edit, fromLink)
  }else{
    // XXX TODO : Dry things up here! This is really similar to Document#applyEdit!
    var incomingEdit = edit.clone()

    if(this.masterLink.sent) edit.follow(this.masterLink.sent)

    /*this.masterLink.queue.forEach(function(pendingEdit) {
      edit.follow(pendingEdit)
    })

    this.masterLink.queue.forEach(function(pendingEdit, i) {
      pendingEdit.transformAgainst(incomingEdit)
      if(0 == i && !this.masterLink.awaitingAck) pendingEdit.parent = edit.id

      incomingEdit.transformAgainst(pendingEdit)
    })
*/ // XXX Just commenting this out for testing ourposes
    // apply changes
    console.log('EditableDocument: apply edit', edit)
    try {
      this.content = edit.changeset.apply(this.content)
      this._setContent(this.content) // XXX Bad for retaining selection!
    }catch(e) {
      var er = new Error('Applying edit "'+edit.id+'" failed: '+e.message)
      if(!fromLink) throw er
      else fromlink.emit('error', er)
      return
    }

    // send ack and forward
    fromLink && fromLink.send('ack', edit.id)
    this.distributeEdit(edit, fromLink)
  }
}