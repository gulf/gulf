/* global xdescribe, describe, it, xit */
var telepath
  , expect = require('expect.js')
  , ottype = require('ottypes').text

try {
  telepath = require('telepath')
}catch(e) {
  telepath = require('../')
}

describe('telepath', function() {

  describe('Linking to new documents', function() {
    var docA = telepath.Document.create(ottype, 'abc')
      , docB = new telepath.Document(ottype)

    var linkA = docA.slaveLink()
      , linkB = docB.masterLink()

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
    var docA = telepath.Document.create(ottype, initialContent)
      , docB = new telepath.EditableDocument(ottype)

    var content = ''
    docB._change = function(newcontent, cs) {
      content = newcontent
      console.log('_change: ', newcontent)
    }

    var linkA = docA.slaveLink()
      , linkB = docB.masterLink()

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
        expect(content).to.eql(docA.content)
        done()
      }, 0)
    })

    it('should replicate insertions across links', function(done) {
      docB.update(cs)

      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.eql(docA.content)
        expect(content).to.eql(docA.content)
        done()
      }, 10)
    })
  })
})
