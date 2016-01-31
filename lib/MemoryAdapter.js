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
// Stores revisions that are synced with the server
function MemoryAdapter() {
  this.reset()
}
module.exports = MemoryAdapter

MemoryAdapter.prototype.createDocument = function(initialSnapshot, cb) {
  this.reset()
  this.storeSnapshot(null, initialSnapshot, cb)
}

MemoryAdapter.prototype.getFirstSnapshot = function(docId, cb) {
  if(!this.history.length) return cb()
  var snapshot = this.snapshots[this.history[0]]
  snapshot = JSON.parse(JSON.stringify(snapshot))
  cb(null, snapshot)
}

MemoryAdapter.prototype.getLatestSnapshot = function(docId, cb) {
  if(!this.history.length) return cb()
  var snapshot = this.snapshots[this.history[this.history.length-1]]
  snapshot = JSON.parse(JSON.stringify(snapshot))
  cb(null, snapshot)
}

MemoryAdapter.prototype.storeSnapshot = function(docId, snapshot, cb) {
  this.history.push(snapshot.id)
  this.snapshots[snapshot.id] = JSON.parse(JSON.stringify(snapshot))
  cb()
}

MemoryAdapter.prototype.reset = function() {
  this.snapshots = {}
  this.history = []
}

MemoryAdapter.prototype.existsSnapshot = function(docId, editId, cb) {
  cb(null, !!this.snapshots[editId])
}

MemoryAdapter.prototype.getSnapshotsAfter = function(docId, editId, cb) {
  var arr = []
  for(var i = this.history.indexOf(editId)+1; i < this.history.length; i++) {
    arr.push(JSON.parse(JSON.stringify(this.snapshots[this.history[i]])))
  }
  cb(null, arr)
}
