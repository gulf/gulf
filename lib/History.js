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
function History(document) {
  this.document = document
}
module.exports = History

History.prototype.reset = function() {
  if('function' == typeof this.document.adapter.reset) this.document.adapter.reset()
}

History.prototype.earliest = function(cb) {
  this.document.adapter.getEarliestEdit(cb)
}

History.prototype.latest = function(cb) {
  this.document.adapter.getLatestEdit(cb)
}

History.prototype.pushEdit = function(edit, cb) {
  // Only Master Document may set ids
  if(!edit.id) edit.id = ++this.idCounter

  this.latest(function(er, latest) {
    if(er) cb && cb(er)
    if(latest && latest.id != edit.parent) cb && cb(new Error('This edit\'s parent is not the latest edit in history: '+JSON.stringify(edit)))
    this.document.adapter.storeEdit(edit, function(er) {
      cb && cb(er)
    })
  }.bind(this))
}

History.prototype.remembers = function(editId, cb) {
  this.document.adapter.existsEdit(editId, function(er, remembers) {
    cb && cb(er, remembers)
  })
}

History.prototype.getAllAfter = function(editId, cb) {
  this.document.adapter.getEditsAfter(editId, function(er, edits) {
    cb && cb(er, edits)
  })
}
