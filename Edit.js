var t

function Edit() {
  t = require('./index')
  this.id
  this.changeset
  this.parent
}

module.exports = Edit

Edit.unpack = function(json) {
  json = JSON.parse(json)
  var edit = new Edit
  edit.id = json.id
  if(json.cs) edit.changeset = t.ot.deserialize? t.ot.deserialize(json.cs) : JSON.parse(json.cs)
  edit.parent = json.parent
  return edit
}

Edit.newInitial = function() {
  var edit = new Edit
  edit.id = randString()
  return edit
}

Edit.newFromChangeset = function(cs) {
  var edit = new Edit
  edit.id = randString()
  edit.changeset = cs
  return edit
}

Edit.prototype.apply = function(snaptshot) {
  if(!this.changeset) return snapshot
  return t.ot.apply(snaptshot, this.changeset)
}

Edit.prototype.follow = function(edit) {
  if(this.parent != edit.parent) throw new Error('Trying to follow an edit that is not a direct sibling.')
  this.transformAgainst(edit)
  this.parent = edit.id
}

Edit.prototype.transformAgainst = function(edit, left) {
  this.changeset = t.ot.transform(this.changeset, edit.changeset, /*side:*/left?'left':'right')
}

Edit.prototype.pack = function() {
  var o = {
    parent: this.parent
  , id: this.id
  }
  if(this.changeset) o.cs = t.ot.serialize? t.ot.serialize(this.changeset) : JSON.stringify(this.changeset)
  return JSON.stringify(o)
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
  while (str.length < 10) {
    str += (Math.random()*1E7<<0x5).toString(36)
  }
  return str
}
