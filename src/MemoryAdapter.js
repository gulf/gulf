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

MemoryAdapter.prototype.reset = function() {
  this.history = []
  this.lastId = 0
}

MemoryAdapter.prototype.getLastRevisionId = function(docId) {
  if(!this.history.length) return Promise.reject()
  return Promise.resolve(this.lastId)
}

MemoryAdapter.prototype.storeRevision = function(rev) {
  this.history[rev.id] = rev
  this.lastId = rev.id
  return Promise.resolve()
}

MemoryAdapter.prototype.getRevision = function(editId) {
  return Promise.resolve(this.history[editId])
}
