// Stores revisions that are synced with the server
function History(document) {
  this.document = document
}
module.exports = History

History.prototype.reset = function() {
  if('function' == typeof this.document.adapter.reset) this.document.adapter.reset()
}

History.prototype.earliest = function(cb) {
  this.document.adapter.getEarliestEdit(cb)
}

History.prototype.latest = function(cb) {
  this.document.adapter.getLatestEdit(cb)
}

History.prototype.pushEdit = function(edit, cb) {
  // Only Master Document may set ids
  if(!edit.id) edit.id = ++this.idCounter

  this.latest(function(er, latest) {
    if(er) cb && cb(er)
    if(latest && latest.id != edit.parent) cb && cb(new Error('This edit\'s parent is not the latest edit in history: '+JSON.stringify(edit)))
    this.document.adapter.storeEdit(edit, function(er) {
      cb && cb(er)
    })
  }.bind(this))
}

History.prototype.remembers = function(editId, cb) {
  this.document.adapter.existsEdit(editId, function(er, remembers) {
    cb && cb(er, remembers)
  })
}

History.prototype.getAllAfter = function(editId, cb) {
  this.document.adapter.getEditsAfter(editId, function(er, edits) {
    cb && cb(er, edits)
  })
}
