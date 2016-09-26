/* global describe, xdescribe, it, xit */
var gulf = require('../')
  , expect = require('expect.js')
  , ottype = require('ottypes').text
  , MuxDmx = require('mux-dmx')
  , through = require('through2')

describe('gulf', function() {

  describe('Linking to new documents', function() {
    var docA, docB
    var linkA, linkB

    before(function(cb) {
      gulf.Document.create('abc', {
        storageAdapter: new gulf.MemoryAdapter
      , ottype: ottype
      }).then(function(doc) {
        docA = doc
        docB = new gulf.Document({
          storageAdapter: new gulf.MemoryAdapter
        , ottype: ottype
        })
        linkA = docA.slaveLink()
        linkB = docB.masterLink()
        cb()
      }, cb)
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
      gulf.Document.create(initialContent, {
        storageAdapter: new gulf.MemoryAdapter
      , ottype: ottype
      }).then(function(doc) {
        docA = doc
        docB = new gulf.EditableDocument({storageAdapter: new gulf.MemoryAdapter, ottype: ottype})

        content = ''
        docB._onBeforeChange = function() { return Promise.resolve() }
        docB._setContent = function(newcontent) {
          content = newcontent
          return Promise.resolve()
        }
        docB._onChange = function(cs) {
          content = ottype.apply(content, cs)
          console.log('_onChange: ', content)
          return Promise.resolve()
        }

        linkA = docA.slaveLink()
        linkB = docB.masterLink()
        cb()
      })
      .catch(cb)
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
      docB.submitChange([3, 'd']) // *bling*
.catch(console.log) 
      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.eql(content)
        expect(docA.content).to.eql(content)
        done()
      }, 0)
    })

    it('should replicate multiple insertions across links', function(done) {
      content = 'abcdefg' // We mimick some edit->cs algo here
      docB.submitChange([4, 'e']) // *bling*
      docB.submitChange([5, 'f']) // *bling*
      docB.submitChange([6, 'g']) // *bling*

      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.eql(content)
        expect(docA.content).to.eql(content)
        done()
      }, 50)
    })

    it('should re-init on error', function(done) {
      docB.submitChange([10, 'e']) // an obviously corrupt edit

      setTimeout(function() {
        console.log('DocB:', docB.content, 'DocA', docA.content)
        expect(docB.content).to.equal(docA.content)
        done()
      }, 100)
    })

    it('should propagate edits correctly after re-init', function(done) {
      content = 'abcdefgh'
      docB.submitChange([7, 'h']) // an correct edit

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
      gulf.Document.create(initialContent, {
        storageAdapter: new gulf.MemoryAdapter
      , ottype: ottype
      }).then(function(doc) {
        masterDoc = doc

        docA = new gulf.EditableDocument({storageAdapter: new gulf.MemoryAdapter, ottype: ottype})
        contentA = ''
        docA._onBeforeChange = function() {return Promise.resolve()}
        docA._setContent = function(newcontent) {
          contentA = newcontent
          return Promise.resolve()
        }
        docA._onChange = function(cs) {
          contentA = ottype.apply(contentA, cs)
          console.log('_onChange(A): ', cs, contentA)
          return Promise.resolve()
        }

        docB = new gulf.EditableDocument({storageAdapter: new gulf.MemoryAdapter, ottype: ottype})
        contentB = ''
        docB._onBeforeChange = function() {return Promise.resolve()}
        docB._setContent = function(newcontent) {
          contentB = newcontent
          return Promise.resolve()
        }
        docB._onChange = function(cs) {
          contentB = ottype.apply(contentB, cs)
          console.log('_onChange(B): ', cs, contentB)
          return Promise.resolve()
        }

        linkA = docA.masterLink(/*{timeout: 3000}*/)
        linkB = docB.masterLink(/*{timeout: 3000}*/)
        cb()
      })
      .catch(cb)
    })

    it('should correctly propagate the initial contents', function(done) {
      linkA.pipe(masterDoc.slaveLink()).pipe(linkA)
      linkB.pipe(masterDoc.slaveLink()).pipe(linkB)

      setTimeout(function() {
        expect(contentA).to.eql(initialContent)
        expect(contentB).to.eql(initialContent)
        done()
      }, 20)
    })

    it('should correctly propagate the first edit from one end to the other end', function(done) {
      contentA = 'abcd'
      docA.submitChange([3, 'd'])

      setTimeout(function() {
        expect(docA.content).to.eql(contentA)
        expect(docB.content).to.eql(contentA)
        expect(contentB).to.eql(contentA)
        done()
      }, 20)
    })

    var slaveB
    it('should correctly propagate edits from one end to the other end', function(done) {
      linkA.unpipe()
      linkB.unpipe()
      masterDoc.links[0].unpipe()
      masterDoc.links[1].unpipe()

      contentA = 'abcd12'
      docA.submitChange([4, '1']) // this edit will be sent
      setImmediate(function() {
        docA.submitChange([5, '2']) // this edit will be queued
      })

      contentB = 'abcd34'
      docB.submitChange([4, '3']) // this edit will be sent
      setImmediate(function() {
        docB.submitChange([5, '4']) // this edit will be queued
      })

      setImmediate(function() {
        linkA.pipe(masterDoc.slaveLink()).pipe(linkA)
        linkB.pipe(slaveB = masterDoc.slaveLink()).pipe(linkB)
      })

      setTimeout(function() {
        expect(contentA).to.eql('abcd1324')
        expect(contentB).to.eql(contentA)
        done()
      }, 1000)
    })

    it('should catch up on reconnect', function(done) {
      this.timeout(12500)
    
      // disconnect B
      linkB.unpipe()
      slaveB.unpipe()

      contentA = 'abcdx1324'
      docA.submitChange([4, 'x']) // this edit will be sent from A -> Master |-> B

      contentB = 'abcd1324QR'
      docB.submitChange([8, 'Q']) // these edits will be sent from B |-> Master -> A
      setImmediate(function() {
        docB.submitChange([9, 'R'])
      })

      setTimeout(function() {
        expect(masterDoc.content).to.equal('abcdx1324')

        // reconnect B
        linkB.pipe(masterDoc.slaveLink()).pipe(linkB)

        setTimeout(function() {
          expect(contentA).to.equal('abcdx1324RQ')
          done()
        }, 1000)
      }, 1000)
    })
  })

  describe('Linking to documents protected by authentication', function() {
    var docA, docB
    var linkA, linkB

    beforeEach(function(done) {
      gulf.Document.create('abc', {
        storageAdapter: new gulf.MemoryAdapter
      , ottype: ottype
      }).then(function(doc) {
        docA = doc
        docB = new gulf.Document({storageAdapter: new gulf.MemoryAdapter, ottype: ottype})
        linkA = docA.slaveLink({
          authenticate: function(credentials) {
            return Promise.resolve(credentials == 'rightCredentials')
          }
        })
        done()
      })
      .catch(done)
    })

    it('should adopt the current document state correctly', function(done) {
      linkB = docB.masterLink({credentials: 'rightCredentials'})
      linkA.pipe(linkB).pipe(linkA)

      setTimeout(function() {
        expect(docA.content).to.eql(docB.content)
        done()
      }, 100)
    })

    it('should not adopt the current document state if authentication failed', function(done) {
      linkB = docB.masterLink({credentials: 'wrongCredentials'})
      linkA.pipe(linkB).pipe(linkA)

      setTimeout(function() {
        expect(docB.content).to.eql(null)
        done()
      }, 100)
    })
  })
  
  describe('Linking to documents protected by write authorization', function() {
    var docA, docB
    var linkA, linkB
    var initialContents = 'abc'

    beforeEach(function(cb) {
      gulf.Document.create(initialContents, {
        storageAdapter: new gulf.MemoryAdapter
      , ottype: ottype
      }).then(function(doc) {
        docA = doc
        docB = new gulf.EditableDocument({storageAdapter: new gulf.MemoryAdapter, ottype: ottype})
        docB._setContent = function(content) {return Promise.resolve()}
        docB._onChange = function(cs) {return Promise.resolve()}
        docB._onBeforeChange = function() {return Promise.resolve()}
        
        linkA = docA.slaveLink({
          authenticate: function(credentials) {
            return Promise.resolve(credentials == 'rightCredentials')
          }
        , authorizeWrite: function(msg, user) {
            return Promise.resolve(msg[0] === 'requestInit'|| msg[0] === 'ack')
          }
        })
        cb()
      })
      .catch(cb)
    })

    it('should adopt the current document state correctly', function(done) {
      linkB = docB.masterLink({credentials: 'rightCredentials'})
      linkA.pipe(linkB).pipe(linkA)

      setTimeout(function() {
        expect(docA.content).to.eql(docB.content)
        done()
      }, 100)
    })

    it('should not accept edits', function(done) {
      linkB = docB.masterLink({credentials: 'rightCredentials'})
      linkA.pipe(linkB).pipe(linkA)

      setTimeout(function() {
        docB.submitChange([3,'d'])
      }, 100)

      setTimeout(function() {
        expect(docB.content).to.eql(initialContents)
        done()
      }, 200)
    })
  })

  describe('Linking documents in parallel environments', function() {
    if (process.browser) return this.skip()

    var initialContent = 'abc'
    var master, docA, docB
    var linkA, linkB
    var contentA, contentB

    before(function(cb) {
      docA = new gulf.EditableDocument({storageAdapter: new gulf.MemoryAdapter, ottype: ottype})
      contentA = ''
      docA._onBeforeChange = function() {return Promise.resolve()}
      docA._setContent = function(newcontent) {
        contentA = newcontent
        return Promise.resolve()
      }
      docA._onChange = function(cs) {
        contentA = ottype.apply(contentA, cs)
        console.log('_onChange(A): ', cs, contentA)
        return Promise.resolve()
      }

      docB = new gulf.EditableDocument({storageAdapter: new gulf.MemoryAdapter, ottype: ottype})
      contentB = ''
      docB._onBeforeChange = function() {return Promise.resolve()}
      docB._setContent = function(newcontent) {
        contentB = newcontent
        return Promise.resolve()
      }
      docB._onChange = function(cs) {
        contentB = ottype.apply(contentB, cs)
        console.log('_onChange(B): ', cs, contentB)
        return Promise.resolve()
      }

      master = require('child_process')
                .fork(__dirname+'/helper/parallelmaster_fork.js', [initialContent],
                  {silent: true})
      master.stderr.pipe(process.stdout)
      master.on('error', function(e) {
        throw e
      })

      linkA = docA.masterLink()
      linkB = docB.masterLink()

      setTimeout(cb, 100)
    })

    it('should propagate initial contents correctly', function(cb) {
      var mux = MuxDmx()
      master.stdout.pipe(mux).pipe(master.stdin)
      linkA.pipe(mux.createDuplexStream(new Buffer('a')))
      // add 100ms latency
      .pipe(through(function(chunk, enc, cb) {
        setTimeout(function() {
          this.push(chunk)
          cb()
        }.bind(this), 100)
      })).pipe(linkA)
      linkB.pipe(mux.createDuplexStream(new Buffer('b'))).pipe(linkB)

      setTimeout(function() {
        expect(contentA).to.equal(initialContent)
        expect(contentB).to.equal(initialContent)
        cb()
      }, 1000)
    })

    it('should correctly propagate the first edit from one end to the other end', function(cb) {
      contentA = 'abcd'
      docA.submitChange([3, 'd'])

      setTimeout(function() {
        expect(docA.content).to.eql(contentA)
        expect(docB.content).to.eql(contentA)
        expect(contentB).to.eql(contentA)
        cb()
      }, 500)
    })

    it('should correctly propagate edits from one end to the other end', function(cb) {
      contentA = 'abcd123'
      docA.submitChange([4, '1']) // this edit will be sent

      contentB = 'abcd45'
      docB.submitChange([4, '4']) // this edit will be sent

      setImmediate(function() {
        docA.submitChange([5, '2']) // this edit will be queued
        docA.submitChange([6, '3'])
        docB.submitChange([5, '5']) // this edit will be queued
      })

      setTimeout(function() {
        console.log(contentA, contentB)
        expect(contentB).to.eql(contentA)
        cb()
      }, 1000)
    })

    after(function() {
      master.kill()
    })

  })
})
