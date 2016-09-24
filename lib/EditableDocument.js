'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
var debug = require('debug')('gulf');
var co = require('co');
var Document = require('./Document'),
    Revision = require('./Revision');

function EditableDocument() {
  this.initialized = false;
  Document.apply(this, arguments);
}

module.exports = EditableDocument;

EditableDocument.prototype = (0, _create2.default)(Document.prototype, { constructor: { value: EditableDocument } });

// overrides Document#attachSlaveLink
EditableDocument.prototype.attachSlaveLink = function () {
  // EditableDocuments can only have a master link! Nothing else, because we
  // need to take care of our own edits here, which are live!
  // -- we don't want to mess with other docs' edits!
  throw new Error('You can\'t attach a slave to an editable document!');
};

// overrides Document#receiveInit
EditableDocument.prototype.receiveInit = co.wrap(_regenerator2.default.mark(function _callee(data, fromLink) {
  var initialRev;
  return _regenerator2.default.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          debug('EditableDocument#receiveInit', data);
          initialRev = Revision.fromJSON(data, this.ottype);


          this.master.reset();
          this.content = initialRev.content;

          _context.next = 6;
          return this.storage.storeRevision(this.id, initialRev);

        case 6:
          _context.prev = 6;
          _context.next = 9;
          return this._setContent(this.content);

        case 9:
          _context.next = 15;
          break;

        case 11:
          _context.prev = 11;
          _context.t0 = _context['catch'](6);

          this.emit('error', _context.t0);
          return _context.abrupt('return');

        case 15:

          this.initialized = true;
          this.emit('init');

        case 17:
        case 'end':
          return _context.stop();
      }
    }
  }, _callee, this, [[6, 11]]);
}));

/**
 * submitChange is called when a modification has been made
 *
 * @param cs A changeset that can be swallowed by the ottype
 */
EditableDocument.prototype.submitChange = co.wrap(_regenerator2.default.mark(function _callee2(cs) {
  var edit, lastRev, pendingEdit, parent, callback, committedEdit;
  return _regenerator2.default.wrap(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          if (!(null === this.content)) {
            _context2.next = 2;
            break;
          }

          throw new Error('Document has not been initialized');

        case 2:
          edit = Revision.newFromChangeset(cs, this.ottype);
          _context2.prev = 3;
          _context2.next = 6;
          return this.storage.getLastRevision(this.id);

        case 6:
          lastRev = _context2.sent;
          _context2.next = 13;
          break;

        case 9:
          _context2.prev = 9;
          _context2.t0 = _context2['catch'](3);

          this.emit('error', _context2.t0);
          throw _context2.t0;

        case 13:

          edit.parent = lastRev.id;

          this.emit('submit', edit);

          // Merge into the queue for increased collab speed

          if (!(this.options.mergeQueue && this.master.queue.length && 'edit' === this.master.queue[this.master.queue.length - 1][0])) {
            _context2.next = 22;
            break;
          }

          pendingEdit = this.master.queue.pop()[1], parent = pendingEdit.parent, callback = pendingEdit.callback;

          pendingEdit = pendingEdit.merge(edit);
          pendingEdit.callback = callback;
          pendingEdit.parent = parent;
          this.master.queue.push(['edit', pendingEdit]);
          return _context2.abrupt('return');

        case 22:
          _context2.next = 24;
          return this.master.sendEdit(edit);

        case 24:
          committedEdit = _context2.sent;


          // Update queue
          this.master.queue.forEach(function (pending) {
            if ('edit' === pending[0]) {
              pending[1].parent = committedEdit.id;
            }
          });

          _context2.prev = 26;
          _context2.next = 29;
          return this.applyEdit(committedEdit, true);

        case 29:
          _context2.next = 35;
          break;

        case 31:
          _context2.prev = 31;
          _context2.t1 = _context2['catch'](26);

          this.master.emit('editError', _context2.t1);
          throw _context2.t1;

        case 35:

          committedEdit.content = this.content;

          _context2.prev = 36;
          _context2.next = 39;
          return this.storage.storeRevision(this.id, committedEdit.toJSON(true));

        case 39:
          _context2.next = 45;
          break;

        case 41:
          _context2.prev = 41;
          _context2.t2 = _context2['catch'](36);

          this.emit('error', _context2.t2);
          throw _context2.t2;

        case 45:

          this.emit('commit', committedEdit, /*ownEdit:*/true);

        case 46:
        case 'end':
          return _context2.stop();
      }
    }
  }, _callee2, this, [[3, 9], [26, 31], [36, 41]]);
}));

// overrides Document#applyEdit
EditableDocument.prototype.applyEdit = co.wrap(_regenerator2.default.mark(function _callee3(edit, ownEdit) {
  var incoming, incomingOriginal, first;
  return _regenerator2.default.wrap(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          // apply changes
          debug('EditableDocument#applyEdit', edit, ownEdit);
          _context3.prev = 1;

          this.content = edit.apply(this.content);

          if (!ownEdit) {
            _context3.next = 5;
            break;
          }

          return _context3.abrupt('return');

        case 5:
          _context3.next = 7;
          return this._onBeforeChange();

        case 7:

          // Transform against possibly missed edits that have happened in the meantime,
          // so that we can apply it

          incoming = edit;


          if (this.master.sentEdit) {
            incomingOriginal = incoming.clone();
            incoming.transformAgainst(this.master.sentEdit, true);
            this.master.sentEdit.follow(incomingOriginal); // Why? So that our history is correct!
          }

          incomingOriginal = incoming.clone();

          // transform incoming against pending
          this.master.queue.forEach(function (pending) {
            if ('edit' === pending[0]) incoming.transformAgainst(pending[1], true);
          });

          // Transform pending edits against the incoming one
          first = true;

          this.master.queue.forEach(function (pending) {
            if (pending[0] !== 'edit') return;
            var pendingEdit = pending[1];
            if (first) {
              pendingEdit.follow(incomingOriginal); // transform + adjust parentage for the first in the line
              first = false;
            } else {
              pendingEdit.transformAgainst(incomingOriginal); // all others have their predecessors as parents
            }

            incomingOriginal.transformAgainst(pendingEdit);
          });

          _context3.next = 15;
          return this._onChange(incoming.changeset);

        case 15:
          _context3.next = 21;
          break;

        case 17:
          _context3.prev = 17;
          _context3.t0 = _context3['catch'](1);

          _context3.t0.message = 'Applying edit failed: ' + _context3.t0.message;
          throw _context3.t0;

        case 21:
        case 'end':
          return _context3.stop();
      }
    }
  }, _callee3, this, [[1, 17]]);
}));

EditableDocument.prototype._onBeforeChange = function () {
  throw new Error('Not implemented! You need to implement this method!');
};
EditableDocument.prototype._onChange = function () {
  throw new Error('Not implemented! You need to implement this method!');
};
EditableDocument.prototype._setContent = function () {
  throw new Error('Not implemented! You need to implement this method!');
};