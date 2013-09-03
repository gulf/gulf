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

/**
 * Prunes an edit from a history of edits (supplied as a list of edit ids)
 * 
 * @return a chronological list of edit ojects
 */
History.prototype.prune = function(editId, history) {
  if(!this.edits[editId]) throw new Error('Unknown edit')
  
  if(!~history.indexOf(editId)) return history // Nothing to prune
  
  var pruningEdit = this.edits[editId].clone().invert()
  
  var prunedHistory = history.slice(history.indexOf(editId)+1)
      .map(function(otherEdit) {
        otherEdit = this.edits[otherEdit].clone()
        otherEdit.transformAgainst(pruningEdit)
        
        pruningEdit.transformAgainst(otherEdit)
        return otherEdit
      })
  
  return prunedHistory
}

/**
 * Find the newest common ancestors of the passed edit and this document
 */
History.findNewestCommonAncestor = function(ancestors1, ancestors2) {
  var anc1 = 0
    , anc2 = 0
    , commonAncestor
  
  if(~ancestors1.indexOf(ancestors2[0])) { // XXX Actually there's no need to call indexOf twice, it just looks more sane
    anc1 = ancestors1.indexOf(ancestors2[0])
  }
  else if(~ancestors2.indexOf(ancestors1[0])) {
    anc2 = ancestors2.indexOf(ancestors1[0])
  }else{
    throw new Error('Edit is of unknown descendancy')
  }
  
  // find the newest common ancestor
  while (ancestors1[anc1] == ancestors2[anc2]) {
    commonAncestor = ancestors1[anc1]
    anc1++
    anc2++
  }
  
  return ancestors1[anc1]
}