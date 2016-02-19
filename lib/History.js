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
var Edit = require('./Edit')
// Stores revisions that are synced with the server
function History(document) {
  this.document = document
}
module.exports = History

History.prototype.reset = function() {
  if('function' == typeof this.document.adapter.reset) this.document.adapter.reset()
}

History.prototype.createDocument = function(snapshot, cb) {
  this.document.adapter.createDocument({
    id: snapshot.edit.id
  , changes: JSON.stringify(snapshot.edit.changeset)
  , contents: snapshot.contents
  , author: snapshot.author
  }, cb)
}

History.prototype.earliest = function(cb) {
  this.document.adapter.getFirstSnapshot(this.document.id, function(er, snapshot) {
    if(er) return cb && cb(er)
    snapshot = { edit: Edit.fromSnapshot(snapshot, this.document.ottype)
               , contents: snapshot.contents
               }
    cb(null, snapshot)
  }.bind(this))
}

History.prototype.latest = function(cb) {
  this.document.adapter.getLatestSnapshot(this.document.id, function(er, snapshot) {
    if(er) return cb && cb(er)
    if(!snapshot) return cb(new Error('No snapshot found'))
    snapshot = { edit: Edit.fromSnapshot(snapshot, this.document.ottype)
               , contents: snapshot.contents
               }
    cb(null, snapshot)
  }.bind(this))
}

History.prototype.storeSnapshot = function(snapshot, cb) {
  this.latest(function(er, latest) {
    if(er) cb && cb(er)
    if(latest && latest.edit.id != snapshot.edit.parent) cb && cb(new Error('This edit\'s parent is not the latest edit in history: '+JSON.stringify(snapshot)))
    if(!snapshot.edit.id) snapshot.edit.id = Edit.randString()
    this.document.adapter.storeSnapshot(this.document.id, {
      id: snapshot.edit.id
    , changes: JSON.stringify(snapshot.edit.changeset)
    , parent: snapshot.edit.parent
    , contents: snapshot.contents
    , author: snapshot.author
    }, function(er) {
      cb && cb(er)
    })
  }.bind(this))
}

History.prototype.remembers = function(snapshotId, cb) {
  this.document.adapter.existsSnapshot(this.document.id, snapshotId, function(er, remembers) {
    cb && cb(er, remembers)
  })
}

History.prototype.getAllAfter = function(snapshotId, cb) {
  this.document.adapter.getSnapshotsAfter(this.document.id, snapshotId, function(er, snapshots) {
    if(er) return cb && cb(er)
    snapshots = snapshots.map(function(snapshot) {
      return { edit: Edit.fromSnapshot(snapshot, this.document.ottype)
              , contents: snapshot.contents
              }
    }.bind(this))
    cb && cb(er, snapshots)
  }.bind(this))
}
