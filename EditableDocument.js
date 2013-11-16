var Document = require('./Document')
  , Edit = require('./Edit')

// XXX Must only have a master link! Nothing else (Why?)
// Because we need to take care of our own edits here, we don't want to mess with other docs' edits!
function EditableDocument() {
  Document.call(this)
}

module.exports = EditableDocument

EditableDocument.prototype = Object.create(Document.prototype, { constructor: { value: EditableDocument }})

EditableDocument.prototype.attachSlaveLink = function() {
  throw new Error('You can\'t attach a slave to an editable document!')
}

EditableDocument.prototype.update = function(cs) {
  if(null === this.content) throw new Error('Document has not been initialized')

  var edit = Edit.newFromChangeset(cs)
  edit.parent = this.history.latest().id

  this.masterLink.sendEdit(edit/* XXX this'll queue it. but in Editable we can just merge into the queue... for performance you know! */ , function onack() {
    this.applyEdit(edit)
    //this.distributeEdit(edit) // Unnecessary
    this.history.pushEdit(edit)
  }.bind(this))
}

// overrides Document#sanitizeEdit
EditableDocument.prototype.sanitizeEdit = function(edit, fromLink) {
  // XXX: REQUEST OUTSTANDING LOCAL EDITS HERE!
  
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
    this.content = edit.apply(this.content)
    this._change(edit.changeset, this.content) // XXX Bad for retaining selection!
  }catch(e) {
    throw new Error('Applying edit "'+edit.id+'" failed: '+e.message)
  }
}