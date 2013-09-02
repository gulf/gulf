// Stores revisions that are synced with the server
function History() {
  this.reset()
}
module.exports = History

History.prototype.earliest = function() {
  if(!this.history.length) return
  return this.edits[this.history[0]]
}

History.prototype.latest = function() {
  if(!this.history.length) return
  return this.edits[this.history[this.history.length-1]]
}

History.prototype.pushEdit = function(edit) {
  if(this.remembers(edit.id)) return
  if(this.latest() && this.latest().id != edit.parent) throw new Error('This edit\'s parent is not the latest edit in history: '+JSON.stringify(edit), console.log(this.history))
  this.history.push(edit.id)
  this.edits[edit.id] = edit
}

History.prototype.reset = function() {
  this.edits = {}
  this.history = []
}

History.prototype.remembers = function(editId) {
  return (this.edits[editId] && true)
}

History.prototype.getAllAfter = function(editId) {
  var arr = []
  for(var i = this.history.indexOf(editId)+1; i < this.history.length; i++) {
    arr.push(this.edits[this.history[i]])
  }
  return arr
}