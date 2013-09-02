var Link = require('./Link')
  , Edit = require('./Edit')
  , History = require('./History')
  , changesets = require('changesets').text

function Document() {
  this.content = null
  this.history = new History
  this.links = []
  this.masterLink = null
}

module.exports = Document

Document.create = function(content) {
  var doc = new Document
  doc.content = content
  doc.history.pushEdit(
    Edit.newFromChangeset(
      changesets.constructChangeset('', content)// This dictates that we use text only... :/
    )
  )
  return doc
}

Document.prototype.createLink = function() {
  var link = new Link
  this.attachLink(link)
  return link
}

Document.prototype.createMasterLink = function() {
  var link = new Link
  this.attachLink(link)
  this.masterLink = link

  link.on('close', function() {
    this.masterLink = null
  }.bind(this))
  
  return link
}

// XXX Prevent people from attaching the same link multiple times
Document.prototype.attachLink = function(link) {
  // If we don't know the document yet, request its content
  if(null === this.content) link.send('requestInit')
  this.links.push(link)

  link.ev.on('requestInit', function() {
    link.send('init', {content: this.content, initialEdit: this.history.latest().pack()})
  }.bind(this))

  // XXX Usually you wouldn't want any link to be able to reset this document!
  // We need some way to determine whether we requested an init from that particular link!
  link.ev.on('init', function(data) {
    this.content = data.content
    this.history.reset()
    this.history.pushEdit(Edit.unpack(data.initialEdit))
  }.bind(this))

  link.ev.on('edit', function onedit(edit) { 
    this.dispatchEdit(Edit.unpack(edit), link)
  }.bind(this))

  link.on('close', function onclose() {
    this.links.splice(this.links.indexOf(link), 1)
  }.bind(this))
}

Document.prototype.dispatchEdit = function(edit, fromLink) {
  // Have we already got this edit?
  if(this.history.remembers(edit.id))
    return fromLink && fromLink.send('ack', edit.id);

  // Check integrity of this edit
  if (!this.history.remembers(edit.parent)) {
    fromLink && fromLink.send('error', new Error('Edit "'+edit.id+'" has unknown parent "'+edit.parent+'"'))
    return
  }

  if(!this.masterLink || fromLink === this.masterLink) 
    this.applyEdit(edit, fromLink)
  else {
    this.masterLink.send('edit', edit.pack())
    this.masterLink.ev.on('ack', function onack(id) {
      if(id == edit.id) {
        this.applyEdit(edit, fromLink)
        this.masterLink.ev.removeListener('ack', onack)
      }
    }.bind(this))
  }
}

Document.prototype.applyEdit = function(edit, fromLink) {
  // Transform against possibly missed edits from history that have happened in the meantime
  this.history.getAllAfter(edit.parent)
    .forEach(function(oldEdit) {
      edit.follow(oldEdit)
    })

  // apply changes
  console.log('Document: apply edit', edit)
  try {
    this.content = edit.changeset.apply(this.content)
  }catch(e) {
    var er = new Error('Applying edit "'+edit.id+'" failed: '+e.message)
    if(!fromLink) throw er
    else fromlink.emit('error', er)
    return
  }

  // add to history
  this.history.pushEdit(edit)

  // send ack
  fromLink && fromLink.send('ack', edit.id)

  // forward edit
  this.distributeEdit(edit, fromLink)
}

Document.prototype.distributeEdit = function(edit, fromLink) {
  // forward edit
  this.links.forEach(function(link) {
    if(link === fromLink) return
    link.send('edit', edit.pack())
  })
}