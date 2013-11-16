try {
  var telepath = require('telepath')
}catch(e) {
  var telepath = require('../')
    , expect = require('expect.js')
}
telepath.ot = require('ottypes').text

describe('telepath', function() {

  describe('Linking to new documents', function() {
    var docA = telepath.Document.create('abc')
      , docB = new telepath.Document

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
    var initialContent = 'abc'
      , cs = [3, 'd']
    var docA = telepath.Document.create(initialContent)
      , docB = new telepath.EditableDocument

    var content = ''
    docB._change = function(cs, newcontent) { content = newcontent }

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
      docB.update(cs)

      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docA.content).to.eql(docB.content)
        done()
      }, 10)
    })
  })
})
