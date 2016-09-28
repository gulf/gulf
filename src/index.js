// Promise polyfill
global.Promise = require('core-js/es6/promise')
if (typeof window !== 'undefined') window.Promise = global.Promise
module.exports = {
  Document: require('./Document')
, EditableDocument: require('./EditableDocument')
, Link: require('./Link')
, Revision: require('./Revision')
, MemoryAdapter: require('./MemoryAdapter')
}

