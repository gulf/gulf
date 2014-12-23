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
  // Only Master Document may set ids
  if(!edit.id) edit.id = ++this.idCounter

  if(this.latest() && this.latest().id != edit.parent) throw new Error('This edit\'s parent is not the latest edit in history: '+JSON.stringify(edit), console.log(this.history))
  this.history.push(edit.id)
  this.edits[edit.id] = edit
}

History.prototype.reset = function() {
  this.edits = {}
  this.history = []
  this.idCounter = 0
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

/**
 * Prunes an edit from a history of edits (supplied as a list of edit ids)
 *
 * @return a chronological list of edit ojects
 */
History.prototype.pruneFrom = function(editId, history) {
  if(!this.edits[editId]) throw new Error('Can\'t prune unknown edit')

  if(!~history.indexOf(editId)) return history // Nothing to prune

  var pruningEdit = this.edits[editId].clone().invert()

  var prunedHistory = history.slice(history.indexOf(editId)+1)
      .map(function(otherEdit) {
        if(!this.edits[otherEdit]) throw new Error('Can\'t reconstruct edit '+otherEdit)
        otherEdit = this.edits[otherEdit].clone()
        otherEdit.transformAgainst(pruningEdit)

        pruningEdit.transformAgainst(otherEdit)
        return otherEdit
      })

  return prunedHistory
}
