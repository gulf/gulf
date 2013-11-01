var link = require('../')
  , expect = require('expect.js')

describe('umbilical', function() {

  describe('Linking to new documents', function() {
    var docA = link.Document.create('abc')
      , docB = new link.Document

    var linkA = docA.createSlaveLink()
      , linkB = docB.createMasterLink()
    
    it('should adopt the current document state correctly', function(done) {
      linkA.pipe(linkB).pipe(linkA)

      setTimeout(function() {
        expect(docA.content).to.eql(docB.content)
        done()
      }, 0)
    })
  })
  
  describe('Linking to editable documents', function() {
    var docA = link.Document.create('abc')
      , docB = new link.EditableDocument

    var content = ''
    docB._getContent = function() { return content }
    docB._setContent = function(c) { content = c }

    var linkA = docA.createSlaveLink()
      , linkB = docB.createMasterLink()

    linkA.on('link:edit', console.log.bind(console, 'edit in linkA'))
    linkA.on('link:ack', console.log.bind(console, 'ack in linkA'))
    linkB.on('link:edit', console.log.bind(console, 'edit in linkB'))
    linkB.on('link:ack', console.log.bind(console, 'ack in linkB'))

    it('should adopt the current document state correctly', function(done) {
      linkA.pipe(linkB).pipe(linkA)
      
      //linkB.pipe(process.stdout)
      //linkA.pipe(process.stdout)

      setTimeout(function() {
        expect(docB.content).to.eql(docA.content)
        done()
      }, 0)
    })
    
    it('should replicate insertions across links', function(done) {
      content = 'abcd'
      docB.update()

      setTimeout(function() {
        expect(docA.content).to.eql(docB.content)
        done()
      }, 0)
    })
  })
})
