/**
 * gulf - Sync anything!
 * Copyright (C) 2013-2015 Marcel Klehr <mklehr@gmx.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
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