var vows = require('vows')
  , assert = require('assert')

var suite = vows.describe('replicate documents live')

var link = require('./')

suite.addBatch({
  'Linking to new documents': {
    topic: function(cb) {
      var docA = link.Document.create('abc')
        , docB = new link.Document

      var linkA = docA.createLink()
        , linkB = docB.createLink()
      
      linkA.pipe(linkB).pipe(linkA)

      return {a: docA, b: docB}
    },
    'should adopt the current document state correctly': function(err, doc) {
      assert.ifError(err)
      assert.equal(doc.a.content, doc.b.content)
    }
  }
, 'Linking to editable documents': {
    topic: function() {
      var docA = link.Document.create('abc')
        , docB = new link.EditableDocument
      
      var content
      docB._getContent = function() { return content }
      docB._setContent = function(c) { content = c }

      var linkA = docA.createLink()
        , linkB = docB.createMasterLink()

      linkA.ev.on('edit', console.log.bind(console, 'edit in linkA'))
      linkA.ev.on('ack', console.log.bind(console, 'ack in linkA'))
      linkB.ev.on('edit', console.log.bind(console, 'edit in linkB'))
      linkB.ev.on('ack', console.log.bind(console, 'ack in linkB'))
      
      linkA.pipe(linkB).pipe(linkA)

      return {a: docA, b: docB}
    },
    'should adopt the current document state correctly': function(err, doc) {
      assert.ifError(err)
      assert.equal(doc.a.content, doc.b.content)
    },
    'insertions': {
      topic: function(doc) {
        doc.b._setContent('abcd')
        doc.b.update()
        process.nextTick(this.callback.bind(this, null, doc))
      },
      'should be replicated across links': function(err, doc) {
        assert.ifError(err)
        assert.equal(doc.a.content, doc.b.content)
      }
    }
  }
})

suite.export(module)