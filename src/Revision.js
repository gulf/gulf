/**
 * gulf - Sync anything!
 * Copyright (C) 2013-2016 Marcel Klehr <mklehr@gmx.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
function Revision(ottype) {
  this.id
  this.parent
  this.changeset
  this.content = null
  this.author
  this.ottype = ottype
  if(!ottype) throw new Error('Revision: No ottype specified')
}

module.exports = Revision

Revision.deserialize = function(json, ottype) {
  json = JSON.parse(json)
  return Revision.fromJSON(json, ottype)
}

Revision.fromJSON = function(json, ottype) {
  if (json.type && ottype.uri !== json.type) throw new Error('Passed OT type does not match serialized revision')

  var r = new Revision(ottype) 
  r.id = json.id
  if (!r.id) throw new Error('Serialized revision does not have an ID')
  
  r.parent = json.parent
  r.changeset = json.changeset
  r.author = json.author
  if (json.content) {
    if(ottype.deserialize) r.content = ottype.deserialize(json.content)
    else r.content = json.content
  }
  return r
}

/**
 * Returns an empty edit.
 */
Revision.newInitial = function(ottype, content) {
  var edit = new Revision(ottype)
  edit.id = randString()
  edit.content = content
  return edit
}

/**
 * Returns an edit with the changes in cs
 */
Revision.newFromChangeset = function(cs, ottype) {
  var edit = new Revision(ottype)
  edit.id = randString()
  edit.changeset = cs
  return edit
}

/**
 * Applies this edit on a snapshot
 */
Revision.prototype.apply = function(snapshot) {
  if(!this.changeset) return snapshot
  return this.ottype.apply(snapshot, this.changeset)
}

/**
 * Transforms this edit to come after the passed
 * edit (rewrites history).
 */
Revision.prototype.follow = function(edit, left) {
  if(this.parent != edit.parent) throw new Error('Trying to follow an edit that is not a direct sibling.')
  this.transformAgainst(edit, left)
  this.parent = edit.id
}

/**
 * Transforms the cahnges this edit makes against the ones that
 * the passed edit makes. This doesn't rewrite history, but manipulates silently.
 */
Revision.prototype.transformAgainst = function(edit, left) {
  this.changeset = this.ottype.transform(this.changeset, edit.changeset, /*side:*/left?'left':'right')
}

Revision.prototype.merge = function(edit) {
  return Revision.newFromChangeset(this.ottype.compose(this.changeset, edit.changeset), this.ottype)
}

Revision.prototype.toJSON = function(withContent) {
  var o = {
    parent: this.parent
  , id: this.id
  , content: null
  , author: this.author
  }
  if(this.changeset) {
    o.changeset = this.changeset
  }
  if (withContent && this.content) {
    if (this.ottype.serialize) o.content = this.ottype.serialize(this.content)
    else o.content = this.content
  }
  return o
}

Revision.prototype.serialize = function(withContent) {
  return JSON.stringify(this.toJSON(withContent))
}

Revision.prototype.clone = function() {
  var edit = new Revision(this.ottype)
  edit.id = this.id
  edit.parent = this.parent
  edit.changeset = this.changeset
  edit.content = this.content

  return edit
}

function randString() {
  var str = ''
  while (str.length < 20) {
    str += (Math.random()*1E7<<0x5).toString(36)
  }
  return str
}
module.exports.randString = randString
