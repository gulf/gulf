var Document = require('./Document')
  , Edit = require('./Edit')
  , changesets = require('changesets').text

// XXX Must only have a master link! (Why?)
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

  this.masterLink.sendEdit(edit, function onack() {
    this.distributeEdit(edit)
    this.history.pushEdit(edit)
  }.bind(this))
}

// overrides Document#applyEdit
EditableDocument.prototype.applyEdit = function(edit, fromLink) {
  this.update()
  
  // Transform against possibly missed edits that have happened in the meantime
  // -- they all gotta be in this queue, since all edits have to be double checked with the master
  if(this.masterLink.sent) edit.follow(this.masterLink.sent)
  this.masterLink.queue.forEach(function(pendingEdit) {
    edit.follow(pendingEdit)
  })
    
  // apply changes
  console.log('EditableDocument: apply edit', edit)
  try {
    this.content = edit.changeset.apply(this.content)
    this._setContent(this.content) // XXX Bad for retaining selection!
  }catch(e) {
    throw new Error('Applying edit "'+edit.id+'" failed: '+e.message)
  }
}