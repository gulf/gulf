// Stores revisions that are synced with the server
function MemoryAdapter() {
  this.reset()
}
module.exports = MemoryAdapter

MemoryAdapter.prototype.getEarliestEdit = function(cb) {
  if(!this.history.length) return cb()
  cb(null, this.edits[this.history[0]])
}

MemoryAdapter.prototype.getLatestEdit = function(cb) {
  if(!this.history.length) return cb()
  cb(null, this.edits[this.history[this.history.length-1]])
}

MemoryAdapter.prototype.storeEdit = function(edit, cb) {
  // Only Master Document may set ids
  if(!edit.id) edit.id = ++this.idCounter

  this.history.push(edit.id)
  this.edits[edit.id] = edit
  cb()
}

MemoryAdapter.prototype.reset = function() {
  this.edits = {}
  this.history = []
  this.idCounter = 0
}

MemoryAdapter.prototype.existsEdit = function(editId, cb) {
  cb(null, this.edits[editId] && true)
}

MemoryAdapter.prototype.getEditsAfter = function(editId, cb) {
  var arr = []
  for(var i = this.history.indexOf(editId)+1; i < this.history.length; i++) {
    arr.push(this.edits[this.history[i]])
  }
  cb(null, arr)
}