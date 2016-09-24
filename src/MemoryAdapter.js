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

// Stores revisions that are synced with the master
function MemoryAdapter() {
  this.reset()
}
module.exports = MemoryAdapter

MemoryAdapter.prototype.createDocument = function(initialRev) {
  this.reset()
  return this.storeRevision(null, initialRev)
}

MemoryAdapter.prototype.getLastRevision = function(docId) {
  if(!this.history.length) return Promise.resolve()
  const o = this.snapshots[this.history[this.history.length-1]]
  return Promise.resolve(o)
}

MemoryAdapter.prototype.storeRevision = function(docId, rev) {
  this.history.push(rev.id)
  this.snapshots[rev.id] = rev
  return Promise.resolve()
}

MemoryAdapter.prototype.reset = function() {
  this.snapshots = {}
  this.history = []
}

MemoryAdapter.prototype.existsRevision = function(docId, editId) {
  return Promise.resolve(!!this.snapshots[editId])
}

MemoryAdapter.prototype.getRevisionsAfter = function(docId, editId) {
  var arr = []
  for(var i = this.history.indexOf(editId)+1; i < this.history.length; i++) {
    arr.push(this.snapshots[this.history[i]])
  }
  return Promise.resolve(arr)
}
