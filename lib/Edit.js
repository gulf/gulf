/**
 * gulf - Sync anything!
 * Copyright (C) 2013-2015 Marcel Klehr <mklehr@gmx.net>
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
    edit.changeset = JSON.parse(json.cs)
  }
  edit.parent = json.parent
  return edit
}

/**
 * Returns an empty edit.
 */
Edit.newInitial = function(ottype) {
  var edit = new Edit(ottype)
  edit.id = randString()
  return edit
}

/**
 * Returns an edit with the changes in cs
 */
Edit.newFromChangeset = function(cs, ottype) {
  var edit = new Edit(ottype)
  edit.id = randString()
  edit.changeset = cs
  return edit
}

/**
 * Returns an edit overtaking every necessary attrib from the snapshot
 */
Edit.fromSnapshot = function(s, ottype) {
  var edit = new Edit(ottype)
  edit.changeset = s.changes? JSON.parse(s.changes) : s.changes
  edit.id = s.id
  edit.parent = s.parent
  return edit
}

/**
 * Applies this edit on a snapshot
 */
Edit.prototype.apply = function(snapshot) {
  if(!this.changeset) return snapshot
  return this.ottype.apply(snapshot, this.changeset)
}

/**
 * Transforms this edit to come after the passed
 * edit (rewrites history).
 */
Edit.prototype.follow = function(edit, left) {
  if(this.parent != edit.parent) throw new Error('Trying to follow an edit that is not a direct sibling.')
  this.transformAgainst(edit, left)
  this.parent = edit.id
}

/**
 * Transforms the cahnges this edit makes against the ones that
 * the passed edit makes. This doesn't rewrite history, but manipulates silently.
 */
Edit.prototype.transformAgainst = function(edit, left) {
  this.changeset = this.ottype.transform(this.changeset, edit.changeset, /*side:*/left?'left':'right')
}

Edit.prototype.merge = function(edit) {
  return Edit.newFromChangeset(this.ottype.compose(this.changeset, edit.changeset), this.ottype)
}

Edit.prototype.pack = function() {
  var o = {
    parent: this.parent
  , id: this.id
  }
  if(this.changeset) {
    o.cs = JSON.stringify(this.changeset)
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
  while (str.length < 20) {
    str += (Math.random()*1E7<<0x5).toString(36)
  }
  return str
}
module.exports.randString = randString
