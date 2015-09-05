var gulf = require('../../')
  , ottype = require('ottypes').text
  , MuxDmx = require('mux-dmx')

console._stdout = process.stderr

gulf.Document.create(new gulf.MemoryAdapter, ottype, process.argv[2], function(er, doc) {
  var mux = MuxDmx()
  process.stdin.pipe(mux).pipe(process.stdout)

  var linkA = new gulf.Link
  linkA.on('link:edit', function(edit) {
    console.log('linkA:edit', edit)
  })
  doc.attachSlaveLink(linkA)
  linkA.pipe(mux.createDuplexStream(new Buffer('a'))).pipe(linkA)


  var linkB = new gulf.Link
  linkB.on('link:edit', function(edit) {
    console.log('linkB:edit', edit)
  })
  doc.attachSlaveLink(linkB)
  linkB.pipe(mux.createDuplexStream(new Buffer('b'))).pipe(linkB)
})
