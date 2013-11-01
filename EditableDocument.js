var Document = require('./Document')
  , Edit = require('./Edit')
  , changesets = require('changesets').text

// XXX Must only have a master link! Nothing else (Why?)
// Because we need to take care of our own edits here, we don't want to mess with other docs' edits!
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

  this.masterLink.sendEdit(edit/* XXX this'll queue it. In Editable we can just merge into the queue.. */ , function onack() {
    this.distributeEdit(edit)
    this.history.pushEdit(edit)
  }.bind(this))
}

// overrides Document#sanitizeEdit
EditableDocument.prototype.sanitizeEdit = function(edit, fromLink) {
  this.update()
  
  // Transform against possibly missed edits that have happened in the meantime
  // -- they all gotta be in this queue, since all edits have to be double checked with the master
  if(this.masterLink.sent) edit.transformAgainst(this.masterLink.sent)
  
  var clonedEdit = edit.clone()
  
  this.masterLink.queue.forEach(function(pendingEdit) {
    edit.transfromAgainst(pendingEdit)
  })
  
  // Transform pending edits against the incoming one
  // so that it can be applied on our editable(!) document
  this.masterLink.queue.forEach(function(pendingEdit, i) {
    if(i == 0) pendingEdit.follow(clonedEdit) // adjust parentage for the first in the line
    else pendingEdit.transformAgainst(clonedEdit) // all others have their predecessors as parents
    
    clonedEdit.transformAgainst(pendingEdit)
  })
}

// overrides Document#applyEdit
EditableDocument.prototype.applyEdit = function(edit, fromLink) {
  // apply changes
  console.log('EditableDocument: apply edit', edit)
  try {
    this.content = edit.changeset.apply(this.content)
    this._setContent(this.content) // XXX Bad for retaining selection!
  }catch(e) {
    throw new Error('Applying edit "'+edit.id+'" failed: '+e.message)
  }
}