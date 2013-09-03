var changesets = require('changesets').text
  , Changeset = changesets.Changeset

function Edit() {
  this.id
  this.changeset
  this.parent
  /*(*/this.ancestors/*)*/
}

module.exports = Edit

Edit.unpack = function(json) {
  json = JSON.parse(json)
  var edit = new Edit
  edit.id = json.id
  edit.changeset = Changeset.unpack(json.cs)
  edit.parent = json.parent
  return edit
}

Edit.newFromChangeset = function(cs) {
  var edit = new Edit
  edit.id = randString()
  edit.changeset = cs
  return edit
}

Edit.prototype.follow = function(edit) {
  if(this.parent != edit.parent) throw new Error('Trying to follow an edit that\'s not a direct sibling.')
  this.transformAgainst(edit)
  this.parent = edit.id
}

Edit.prototype.transformAgainst = function(edit) {
  this.changeset = this.changeset.transformAgainst(edit.changeset)
}

Edit.prototype.pack = function() {
  return JSON.stringify({parent: this.parent, id: this.id, cs: this.changeset.pack()})
}

Edit.prototype.clone = function() {
  var edit = new Edit
  edit.id = this.id
  edit.parent = this.parent
  edit.changeset = this.changeset
  return edit
}

function randString() {
  var str = ''
  while (str.length < 9) {
    str += (Math.random()*100).toString(36)
  }
  return str
}