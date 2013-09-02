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
      changesets.constructChangeset('', content)// This dictates that we use text only... :/ -- we could add some dummy first edit...
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

// XXX Detach link!

// XXX Prevent people from attaching the same link multiple times
Document.prototype.attachLink = function(link) {
  // If we don't know the document yet, request its content
  if(null === this.content) link.send('requestInit')
  this.links.push(link)

  link.on('link:requestInit', function() {
    link.send('init', {content: this.content, initialEdit: this.history.latest().pack()})
  }.bind(this))

  // XXX Usually you wouldn't want any link to be able to reset this document!
  // We need some way to determine whether we requested an init from that particular link!
  link.on('link:init', function(data) {
    this.content = data.content
    this.history.reset()
    this.history.pushEdit(Edit.unpack(data.initialEdit))
  }.bind(this))

  link.on('link:edit', function onedit(edit) { 
    if(!this.masterLink || link === this.masterLink)
      this.dispatchEdit(Edit.unpack(edit), link)
    else {
      // check with master
      this.masterLink.send('edit', edit.pack())
      this.masterLink.once('link:ack', function (id) {
        if(id == edit.id) {
          this.dispatchEdit(edit, link)
        }
      }.bind(this))
    }
  }.bind(this))

  link.on('close', function onclose() {
    this.links.splice(this.links.indexOf(link), 1)
  }.bind(this))
}

/**
 * Dispatch a received edit
 * 
 * @param edit <Edit>
 * @param fromLink <Link> (optional>
 */
Document.prototype.dispatchEdit = function(edit, fromLink) {
  // Have we already got this edit?
  if(this.history.remembers(edit.id))
    return fromLink && fromLink.send('ack', edit.id);

  // Check integrity of this edit
  if (!this.history.remembers(edit.parent)) {
    fromLink && fromLink.emit('error', new Error('Edit "'+edit.id+'" has unknown parent "'+edit.parent+'"'))
    return
  }

  try {
    this.applyEdit(edit)
  }catch(e) {
    if(!fromLink) throw er
    else fromlink.emit('error', er)
  }
  fromLink && fromLink.send('ack', edit.id)
  this.distributeEdit(edit, fromLink)
}

Document.prototype.applyEdit = function(edit) {
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
    throw new Error('Applying edit "'+edit.id+'" failed: '+e.message)
  }

  // add to history
  this.history.pushEdit(edit) // XXX parent is wrong after all the transformations above
}

Document.prototype.distributeEdit = function(edit, fromLink) {
  // forward edit
  this.links.forEach(function(link) {
    if(link === fromLink) return
    link.send('edit', edit.pack())
  })
}