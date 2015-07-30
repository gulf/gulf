/* global xdescribe, describe, it, xit */
var gulf, expect
  , ottype = require('ottypes').text


try {
  gulf = require('gulf')
}catch(e) {
  console.log(e)
  gulf = require('../')
  expect = require('expect.js')
}

describe('gulf', function() {

  describe('Linking to new documents', function() {
    var docA, docB
    var linkA, linkB
    
    before(function(cb) {
      gulf.Document.create(new gulf.MemoryAdapter, ottype, 'abc', function(er, doc) {
        docA = doc
        docB = new gulf.Document(new gulf.MemoryAdapter, ottype)
        linkA = docA.slaveLink()
        linkB = docB.masterLink()
        cb()
      })
    })

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
    var docA, docB
    var linkA, linkB
    var content

    before(function(cb) {
      gulf.Document.create(new gulf.MemoryAdapter, ottype, initialContent, function(er, doc) {
        docA = doc
        docB = new gulf.EditableDocument(new gulf.MemoryAdapter, ottype)

        content = ''
        docB._change = function(newcontent, cs) {
          content = newcontent
          console.log('_change: ', newcontent)
        }

        linkA = docA.slaveLink()
        linkB = docB.masterLink()
        cb()
      })
    })
    

    /*linkA.on('link:edit', console.log.bind(console, 'edit in linkA'))
    linkA.on('link:ack', console.log.bind(console, 'ack in linkA'))
    linkB.on('link:edit', console.log.bind(console, 'edit in linkB'))
    linkB.on('link:ack', console.log.bind(console, 'ack in linkB'))*/

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
      content = 'abcd' // We mimick some edit->cs algo here
      docB.update([3, 'd']) // *bling*

      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.eql(content)
        expect(docA.content).to.eql(content)
        done()
      }, 0)
    })

    it('should replicate multiple insertions across links', function(done) {
      content = 'abcdefg' // We mimick some edit->cs algo here
      docB.update([4, 'e']) // *bling*
      docB.update([5, 'f']) // *bling*
      docB.update([6, 'g']) // *bling*

      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.eql(content)
        expect(docA.content).to.eql(content)
        done()
      }, 20)
    })
    
    it('should re-init on error', function(done) {
      docB.update([10, 'e']) // an obviously corrupt edit
      
      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.equal(docA.content)
        done()
      }, 100)
    })
    
    it('should propagate edits correctly after re-init', function(done) {
      content = 'abcdefgh'
      docB.update([7, 'h']) // an correct edit
      
      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.equal(docA.content)
        expect(docA.content).to.equal(content)
        done()
      }, 20)
    })
  })
  
  describe('Linking two editable documents via a master', function() {
    var initialContent = 'abc'
    var masterDoc, docA, docB
    var linkA, linkB
    var contentA, contentB

    before(function(cb) {
      gulf.Document.create(new gulf.MemoryAdapter, ottype, initialContent, function(er, doc) {
        masterDoc = doc

        docA = new gulf.EditableDocument(new gulf.MemoryAdapter, ottype)
        contentA = ''
        docA._collectChanges = function() {}
        docA._change = function(newcontent, cs) {
          contentA = newcontent
          console.log('_change(A): ', newcontent, cs)
        }

        docB = new gulf.EditableDocument(new gulf.MemoryAdapter, ottype)
        contentB = ''
        docB._collectChanges = function() {}
        docB._change = function(newcontent, cs) {
          contentB = newcontent
          console.log('_change(B): ', newcontent, cs)
        }

        linkA = docA.masterLink()
        linkB = docB.masterLink()
        cb()
      })
    })
    
    it('should correctly propagate the initial contents', function(cb) {
      linkA.pipe(masterDoc.slaveLink()).pipe(linkA)
      linkB.pipe(masterDoc.slaveLink()).pipe(linkB)
      
      setTimeout(function() {
        expect(contentA).to.eql(initialContent)
        expect(contentB).to.eql(initialContent)
        cb()
      }, 20)
    })
    
    it('should correctly propagate the first edit from one end to the other end', function(cb) {
      contentA = 'abcd'
      docA.update([3, 'd'])
      
      setTimeout(function() {
        expect(docA.content).to.eql(contentA)
        expect(docB.content).to.eql(contentA)
        expect(contentB).to.eql(contentA)
        cb()
      }, 20)
    })
    
    it('should correctly propagate edits from one end to the other end', function(cb) {
      linkA.unpipe()
      linkB.unpipe()
      masterDoc.links[0].unpipe()
      masterDoc.links[1].unpipe()

      contentA = 'abcd1'
      docA.update([4, '1'])
      
      contentB = 'abcd2'
      docB.update([4, '2'])
      
      linkA.pipe(masterDoc.slaveLink()).pipe(linkA)
      linkB.pipe(masterDoc.slaveLink()).pipe(linkB)
      
      setTimeout(function() {
        expect(contentB).to.eql(contentA)
        cb()
      }, 200)
    })
  })
})
