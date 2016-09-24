'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

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
var Link = require('./Link'),
    Revision = require('./Revision'),
    queue = require('queue'),
    EventEmitter = require('events').EventEmitter,
    co = require('co');

function Document(options) {
  EventEmitter.apply(this);
  this.id;
  this.options = {
    mergeQueue: true
  };
  for (var prop in options) {
    this.options[prop] = options[prop];
  }this.storage = this.options.storageAdapter;
  this.ottype = this.options.ottype;

  this.content = null;
  this.initialized = false;

  this.slaves = [];
  this.links = [];
  this.master = null;

  this.queue = queue();
  this.queue.concurrency = 1;
  this.queue.start();

  if (!this.ottype) throw new Error('Document: No ottype specified');
  if (!this.storage) throw new Error('Document: No adapter specified');
  this.on('error', console.log);
}

module.exports = Document;

Document.prototype = (0, _create2.default)(EventEmitter.prototype, { constructor: { value: Document } });

/**
 * Creates a new document
 * @param content The initial document contents
 * @param opts The options to be passed to the document
 */
Document.create = function (content, opts) {
  var doc = new Document(opts);
  var rev = Revision.newInitial(doc.ottype, content);
  return doc.storage.createDocument(rev.toJSON( /*withContent:*/true)).then(function (id) {
    doc.initialized = true;
    doc.content = content;
    doc.id = id;
    doc.emit('init');

    return doc;
  });
};

/**
 * Load an existing document
 * @param id The id of the document to load
 * @param opts The options to pass to the document
 */
Document.load = function (id, opts) {
  var doc = new Document(opts);
  return doc.storage.getLastRevision(id).then(function (rev) {
    doc.initialized = true;
    doc.content = rev.content;
    doc.id = id;
    doc.emit('init');

    return doc;
  });
};

/**
 * Creates a new Link and attaches it as a slave
 * @param opts Options to be passed to Link constructor
 */
Document.prototype.slaveLink = function (opts) {
  var link = new Link(opts);
  this.attachSlaveLink(link);
  return link;
};

/**
 * Creates a new Link and attaches it as master
 * (You will want to listen to the link's 'close' event)
 * @param opts Options to be passed to Link constructor
 */
Document.prototype.masterLink = function (opts) {
  var link = new Link(opts);
  this.attachMasterLink(link);
  return link;
};

/**
 * Attaches a link as master
 */
Document.prototype.attachMasterLink = function (link) {
  var _this = this;

  this.master = link;
  this.attachLink(link);

  link.on('editError', function () {
    link.send('requestInit');
  });

  link.on('finish', function () {
    _this.master = null;
  });
};

/**
 * Attaches a link as a slave
 */
Document.prototype.attachSlaveLink = function (link) {
  var _this2 = this;

  this.slaves.push(link);
  this.attachLink(link);

  link.on('editError', function () {
    _this2.storage.getLastRevision(_this2.id).then(function (latest) {
      link.send('init', latest); // we skip toJSON(fromJSON(x)) here
    }).catch(function (e) {
      return _this2.emit('error', e);
    });
  });

  link.on('finish', function () {
    _this2.slaves.splice(_this2.slaves.indexOf(link), 1);
  });
};

Document.prototype.attachLink = function (link) {
  var _this3 = this;

  if (~this.links.indexOf(link)) return;

  this.links.push(link);

  // Other end requests init? can do.
  link.on('link:requestInit', function () {
    _this3.receiveRequestInit(link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  // Other side sends init.
  link.on('link:init', function (data) {
    _this3.receiveInit(data, link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  link.on('link:requestHistorySince', function (since) {
    _this3.receiveRequestHistorySince(since, link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  // Other side sends edit.
  link.on('link:edit', function (edit) {
    _this3.receiveEdit(edit, link.authenticated, link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  link.on('finish', function () {
    _this3.detachLink(link);
  });

  // If we don't know the document yet, request its content
  if (null === this.content) link.send('requestInit');
};

Document.prototype.detachLink = function (link) {
  var idx;
  if (!~(idx = this.links.indexOf(link))) return;
  this.links.splice(idx, 1);
  link.reset();
};

Document.prototype.close = function () {
  this.links.forEach(function (l) {
    l.reset();
  });
  this.links = [];
  this.master = null;
  this.slaves = [];
};

Document.prototype.receiveRequestInit = co.wrap(_regenerator2.default.mark(function _callee(link) {
  var _this4 = this;

  var latest;
  return _regenerator2.default.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          debug('receiveRequestInit');

          if (this.initialized) {
            _context.next = 4;
            break;
          }

          _context.next = 4;
          return function (cb) {
            return _this4.once('init', cb);
          };

        case 4:
          _context.next = 6;
          return this.storage.getLastRevision(this.id);

        case 6:
          latest = _context.sent;


          link.send('init', latest); // We skip toJSON(fromJSON(x))

        case 8:
        case 'end':
          return _context.stop();
      }
    }
  }, _callee, this);
}));

/**
 * Receive init
 *
 * @param data {Object} (Serialized Revision with content)
 * @param fromLink
 */
Document.prototype.receiveInit = co.wrap(_regenerator2.default.mark(function _callee2(data, fromLink) {
  var initialRev;
  return _regenerator2.default.wrap(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          debug('receiveInit', data);
          // I'm master? Don't go bossing me around!

          if (!(!this.master || fromLink !== this.master)) {
            _context2.next = 3;
            break;
          }

          return _context2.abrupt('return');

        case 3:
          initialRev = Revision.fromJSON(data, this.ottype);


          this.links.forEach(function (link) {
            return link.reset();
          });
          this.content = initialRev.content;

          _context2.next = 8;
          return this.storage.storeRevision(this.id, initialRev.toJSON(true));

        case 8:

          // I got an init, so my slaves get one, too
          this.slaves.forEach(function (slave) {
            slave.send('init', data);
          });

          this.initialized = true;
          this.emit('init');

        case 11:
        case 'end':
          return _context2.stop();
      }
    }
  }, _callee2, this);
}));

/**
 * Receive a requestHistorySince message
 *
 * @param sinceEditId String The last known edit id by the slave
 * @param fromLink
 */
Document.prototype.receiveRequestHistorySince = co.wrap(_regenerator2.default.mark(function _callee3(sinceEditId, fromLink) {
  var _this5 = this;

  var revs;
  return _regenerator2.default.wrap(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return this.storage.getRevisionsAfter(this.id, sinceEditId);

        case 2:
          revs = _context3.sent;

          fromLink.reset();
          revs.map(function (r) {
            return Revision.fromJSON(r, _this5.ottype);
          }).forEach(function (rev) {
            return fromLink.sendEdit(rev);
          });

        case 5:
        case 'end':
          return _context3.stop();
      }
    }
  }, _callee3, this);
}));

/**
 * Receive an edit
 *
 * @param edit <Edit>
 * @paramfromLink <Link>
 */
Document.prototype.receiveEdit = co.wrap(_regenerator2.default.mark(function _callee4(edit, author, fromLink) {
  var _this6 = this;

  var queueCb;
  return _regenerator2.default.wrap(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          debug('receiveEdit', edit);

          edit = Revision.fromJSON(edit, this.ottype);
          edit.author = author;

          if (!(this.master && fromLink !== this.master)) {
            _context4.next = 6;
            break;
          }

          _context4.next = 6;
          return this.master.sendEdit(edit);

        case 6:
          _context4.next = 8;
          return function (resolve) {
            _this6.queue.push(function (cb) {
              return resolve(null, cb);
            });
            _this6.queue.start();
          };

        case 8:
          queueCb = _context4.sent;
          _context4.prev = 9;
          _context4.next = 12;
          return this.dispatchEdit(edit, fromLink);

        case 12:
          _context4.next = 17;
          break;

        case 14:
          _context4.prev = 14;
          _context4.t0 = _context4['catch'](9);

          this.emit('error', _context4.t0);

        case 17:
          queueCb();

        case 18:
        case 'end':
          return _context4.stop();
      }
    }
  }, _callee4, this, [[9, 14]]);
}));

/**
 * Dispatch a received edit
 *
 * @param edit <Edit>
 * @param fromLink <Link> (optional>
 */
Document.prototype.dispatchEdit = co.wrap(_regenerator2.default.mark(function _callee5(edit, fromLink) {
  var _this7 = this;

  var sendAck, alreadyExists, parentExists, latestRev;
  return _regenerator2.default.wrap(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          if (!(fromLink && fromLink.sentEdit && fromLink.sentEdit.id === edit.id)) {
            _context5.next = 5;
            break;
          }

          fromLink.sentEdit.callback(null, fromLink.sentEdit);
          fromLink.sentEdit = null;
          (0, _setImmediate3.default)(function () {
            fromLink._read(0);
          });
          return _context5.abrupt('return');

        case 5:
          sendAck = function sendAck() {
            // If I'm master then we need to queue the ack
            // Slaves have to send it straight away
            if (fromLink === _this7.master) fromLink.send('ack', edit.id);else if (fromLink) fromLink.sendAck(edit.id);
          };

          if (this.initialized) {
            _context5.next = 9;
            break;
          }

          _context5.next = 9;
          return function (cb) {
            return _this7.once('init', function () {
              return cb();
            });
          };

        case 9:
          _context5.next = 11;
          return this.storage.existsRevision(this.id, edit.id);

        case 11:
          alreadyExists = _context5.sent;

          if (!alreadyExists) {
            _context5.next = 15;
            break;
          }

          sendAck();
          return _context5.abrupt('return');

        case 15:
          _context5.next = 17;
          return this.storage.existsRevision(this.id, edit.parent);

        case 17:
          parentExists = _context5.sent;

          if (parentExists) {
            _context5.next = 29;
            break;
          }

          if (!(fromLink === this.master)) {
            _context5.next = 27;
            break;
          }

          _context5.next = 22;
          return this.storage.getLastRevision(this.id);

        case 22:
          latestRev = _context5.sent;

          this.master.send('requestHistorySince', latestRev.id);
          return _context5.abrupt('return');

        case 27:
          // I'm master, I can't have missed that edit. So, throw and re-init!
          fromLink && fromLink.emit('editError', new Error('Edit "' + edit.id + '" has unknown parent "' + edit.parent + '"'));
          return _context5.abrupt('return');

        case 29:
          _context5.prev = 29;
          _context5.next = 32;
          return this.sanitizeEdit(edit, fromLink);

        case 32:
          _context5.next = 34;
          return this.applyEdit(edit, /*ownEdit*/false);

        case 34:
          _context5.next = 40;
          break;

        case 36:
          _context5.prev = 36;
          _context5.t0 = _context5['catch'](29);

          fromLink && fromLink.emit('editError', _context5.t0);
          return _context5.abrupt('return');

        case 40:

          // add to history
          edit.content = this.content;
          _context5.next = 43;
          return this.storage.storeRevision(this.id, edit.toJSON(true));

        case 43:

          sendAck();
          this.distributeEdit(edit, fromLink);
          this.emit('commit', edit, /*ownEdit:*/false);

        case 46:
        case 'end':
          return _context5.stop();
      }
    }
  }, _callee5, this, [[29, 36]]);
}));

/**
 * Returns an edit that is able to be applied
 */
Document.prototype.sanitizeEdit = co.wrap(_regenerator2.default.mark(function _callee6(edit, fromLink, cb) {
  var _this8 = this;

  var missed;
  return _regenerator2.default.wrap(function _callee6$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          if (!(this.master === fromLink)) {
            _context6.next = 4;
            break;
          }

          return _context6.abrupt('return');

        case 4:
          _context6.next = 6;
          return this.storage.getRevisionsAfter(this.id, edit.parent);

        case 6:
          missed = _context6.sent;


          missed.map(function (rev) {
            return Revision.fromJSON(rev, _this8.ottype);
          }).forEach(function (oldRev) {
            try {
              debug('sanitize', 'transform', edit, oldRev);
              edit.follow(oldRev);
            } catch (e) {
              e.message = 'Transforming ' + edit.id + ' against ' + oldRev.id + ' failed: ' + e.message;
              throw e;
            }
          });

          if (missed.length > 10) {
            // this one apparently missed a lot of edits, looks like this is a reconnect
            // -> send 'em our stash
            missed.forEach(function (oldRev) {
              fromLink.send('edit', oldRev);
            });
          }

        case 9:
        case 'end':
          return _context6.stop();
      }
    }
  }, _callee6, this);
}));

Document.prototype.applyEdit = function (edit, ownEdit) {
  // apply changes
  debug('Document: apply edit', edit);
  try {
    this.content = edit.apply(this.content);
    return _promise2.default.resolve();
  } catch (e) {
    e.message = 'Applying edit failed: ' + e.message;
    return _promise2.default.reject(e);
  }
};

Document.prototype.distributeEdit = function (edit, fromLink) {
  var _this9 = this;

  // forward edit
  this.links.forEach(function (link) {
    if (link === fromLink) return;
    if (link === _this9.master) return;

    link.sendEdit(edit);
  });
};