'use strict';

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

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
var Duplex = require('stream').Duplex;
var debug = require('debug')('gulf');
require('setimmediate');
var SECONDS = 1000;

/**
 * This is a Link
 * The public should interact with it via node's streams API (ie. using .pipe etc.)
 * Internally, it emits events ("link:*") that are picked up by the Document it is attached to.
 */
function Link(opts) {
  if (!opts) opts = {};
  this.timeout = opts.timeout || 10 * SECONDS;
  this.credentials = opts.credentials;
  this.authenticateFn = opts.authenticate;
  this.authorizeReadFn = opts.authorizeRead;
  this.authorizeWriteFn = opts.authorizeWrite;
  this.authenticated;
  this.sentEdit;
  this.sentRequestInit;
  this.queue;
  this.linkBuffer = '';

  Duplex.call(this, { allowHalfOpen: false, objectMode: true });

  this.on('error', function (er) {
    debug('Error in link', 'undefined' != typeof window ? er : er.stack || er);
  }.bind(this));

  this.on('editError', function (er) {
    debug('EditError in link', 'undefined' != typeof window ? er : er.stack || er);
  });

  this.reset();
}
Link.prototype = (0, _create2.default)(Duplex.prototype, { constructor: { value: Link } });

module.exports = Link;

Link.prototype.reset = function () {
  this.queue = [];
  if (this.sentEdit) clearTimeout(this.sentEdit.timeout);
  this.sentEdit = null;
};

/**
 * Pipeline an event
 * Please, Don't send edits with this method! Use .sendEdit() to queue it, like everyone else.
 */
Link.prototype.send = function (event /*, args..*/) {
  var _this = this;

  if ('requestInit' === event) this.sentRequestInit = true;

  var msg = Array.prototype.slice.call(arguments);

  // Authorize message
  this.authorizeRead(msg).then(function (authorized) {
    // If unauthorized, tell them
    if (!authorized) return _this.sendUnauthorized();

    // If this is an edit, add a timeout, after which we retry
    if ('edit' === event) {
      var edit = msg[1],
          cb = edit.callback;
      var timeout = setTimeout(function () {
        _this.send('edit', edit);
      }, _this.timeout);
      edit.callback = function () {
        clearTimeout(timeout);
        cb && cb.apply(null, arguments);
      };
      msg[1] = edit.toJSON();
    }

    var data = (0, _stringify2.default)(msg);
    debug('->', data);
    _this.push(data + '\n');
  }).catch(function (e) {
    _this.emit('error', er);
  });
};

Link.prototype.sendUnauthenticated = function () {
  this.push((0, _stringify2.default)(['unauthenticated']) + '\n');
};

Link.prototype.sendAuthenticate = function () {
  this.push((0, _stringify2.default)(['authenticate', this.credentials]) + '\n');
};

Link.prototype.sendAuthenticated = function (status) {
  this.push((0, _stringify2.default)(['authenticated', status]) + '\n');
};

Link.prototype.sendUnauthorized = function () {
  this.push((0, _stringify2.default)(['unauthorized']) + '\n');
};

/*
 * Put an edit into the queue
 * @param edit {Edit} the edit to send through this link
 * @param cb {Function} Get callback when the edit has been acknowledged (optional)
 */
Link.prototype.sendEdit = function (edit) {
  var promise = new _promise2.default(function (resolve) {
    return edit.callback = resolve;
  });

  if (this.queue.length || this.sentEdit) {
    this.queue.push(['edit', edit]);
  } else {
    this.sentEdit = edit;
    this.send('edit', edit);
  }
  return promise;
};

Link.prototype.sendAck = function (editId) {
  if (this.queue.length || this.sentEdit) {
    this.queue.push(['ack', editId]);
  } else {
    this.send('ack', editId);
  }
};

// This is only used to push edits from the queue into the pipeline.
// All other events are pushed directly in .send()
Link.prototype._read = function () {
  if (this.sentEdit) return;
  if (!this.queue[0]) return;
  var msg;
  while (msg = this.queue.shift()) {
    if ('edit' === msg[0]) {
      this.sentEdit = msg[1];
    }

    this.send.apply(this, msg);
    if ('edit' === msg[0]) break;
  }
};

Link.prototype._write = function (buf, enc, cb) {
  this.linkBuffer += buf.toString();
  var idx = this.linkBuffer.indexOf('\n');
  if (idx === -1) return cb();
  var msgs = [];
  while (idx !== -1) {
    msgs.push(this.linkBuffer.substr(0, idx));
    this.linkBuffer = this.linkBuffer.substr(idx + 1);
    idx = this.linkBuffer.indexOf('\n');
  }
  iterate.apply(this);
  function iterate(er) {
    if (er) return cb(er);
    if (!msgs.length) return cb();
    this.onwrite(msgs.shift(), iterate.bind(this));
  }
};

Link.prototype.onwrite = function (data, cb) {
  var _this2 = this;

  debug('<- _write:', data);
  var args = JSON.parse(data);

  // ['authenticate', Mixed]
  if (args[0] === 'authenticate') {
    this.authenticate(args[1]).then(function (authed) {
      _this2.authenticated = authed;
      _this2.sendAuthenticated(!!authed);
      cb();
    }, function (error) {
      _this2.emit('error', error);
    });
    return;
  }

  // ['authenticated', Bool]
  if (args[0] === 'authenticated') {
    if (!args[1]) return this.emit('error', new Error('Authentication failed'));
    if (this.sentRequestInit) this.send('requestInit');else if (this.sentEdit) this.send('edit', this.sentEdit);
    cb();
    return;
  }

  // ['unauthenticated']
  if (args[0] === 'unauthenticated') {
    this.sendAuthenticate();
    cb();
    return;
  }

  // ['unauthorized']
  if (args[0] === 'unauthorized') {
    this.send('requestInit');
    cb();
    return;
  }

  if (!this.authenticated && this.authenticateFn) {
    this.sendUnauthenticated();
    cb();
    return;
  }

  if (args[0] === 'init') {
    this.sentRequestInit = false;
  }

  this.authorizeWrite(args).then(function (authorized) {
    if (!authorized) {
      _this2.sendUnauthorized();
      cb();
      return;
    }

    // Intercept acks for shifting the queue and calling callbacks
    if (args[0] == 'ack') {
      var id = args[1];

      if (_this2.sentEdit && typeof _this2.sentEdit.callback == 'function') {
        // Callback
        _this2.sentEdit.id = id;
        // The nextTick shim for browsers doesn't seem to enforce the call order
        // (_read is called below and they must be in that order), so we call directly
        //nextTick(this.sentEdit.callback.bind(null, null, this.sentEdit))
        try {
          _this2.sentEdit.callback(_this2.sentEdit);
        } catch (e) {
          _this2.emit('error', e);
        }
        delete _this2.sentEdit.callback;
      }
      _this2.sentEdit = null;

      (0, _setImmediate3.default)(function () {
        this._read(0);
      }.bind(_this2));
    }

    args[0] = 'link:' + args[0];
    _this2.emit.apply(_this2, args);
    cb();
  }).catch(function (e) {
    _this2.emit('error', e);
  });
};

Link.prototype.authenticate = function (credentials) {
  return this.authenticateFn(credentials);
};

Link.prototype.authorizeWrite = function (msg) {
  if (!this.authorizeWriteFn) return _promise2.default.resolve(true);
  return this.authorizeWriteFn(msg, this.authenticated);
};

Link.prototype.authorizeRead = function (msg) {
  if (!this.authorizeReadFn) return _promise2.default.resolve(true);
  return this.authorizeReadFn(msg, this.authenticated);
};