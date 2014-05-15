function Edit(ottype) {
  this.id
  this.changeset
  this.parent
  this.ottype = ottype
  if(!ottype) throw new Error('Edit: No ottype specified')
}

module.exports = Edit

Edit.unpack = function(json, ottype) {
  json = JSON.parse(json)

  var edit = new Edit(ottype)
  edit.id = json.id
  if(json.cs) {
    edit.changeset = ottype.deserialize?
                          ottype.deserialize(json.cs)
                        : JSON.parse(json.cs)
  }
  edit.parent = json.parent
  return edit
}

Edit.newInitial = function(ottype) {
  var edit = new Edit(ottype)
  edit.id = randString()
  return edit
}

Edit.newFromChangeset = function(cs, ottype) {
  var edit = new Edit(ottype)
  edit.id = randString()
  edit.changeset = cs
  return edit
}

Edit.prototype.apply = function(snapshot) {
  if(!this.changeset) return snapshot
  return this.ottype.apply(snapshot, this.changeset)
}

Edit.prototype.follow = function(edit) {
  if(this.parent != edit.parent) throw new Error('Trying to follow an edit that is not a direct sibling.')
  this.transformAgainst(edit)
  this.parent = edit.id
}

Edit.prototype.transformAgainst = function(edit, left) {
  this.changeset = this.ottype.transform(this.changeset, edit.changeset, /*side:*/left?'left':'right')
}

Edit.prototype.pack = function() {
  var o = {
    parent: this.parent
  , id: this.id
  }
  if(this.changeset) {
    o.cs = this.ottype.serialize?
              this.ottype.serialize(this.changeset)
            : JSON.stringify(this.changeset)
  }
  return JSON.stringify(o)
}

Edit.prototype.clone = function() {
  var edit = new Edit(this.ottype)
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
