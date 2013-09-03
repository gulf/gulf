var Link = require('./Link')
  , Edit = require('./Edit')
  , History = require('./History')
  , changesets = require('changesets').text

function Document() {
  this.content = null
  this.history = new History
  this.links = []
  this.slaves = []
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
  // no peer link allowed here if we already have a master link
  this.attachLink(link)
  return link
}

Document.prototype.createSlaveLink = function() {
  var link = new Link
  this.attachSlaveLink(link)
  return link
}

Document.prototype.createMasterLink = function() {
  var link = new Link
  this.attachMasterLink(link)
  return link
}

// XXX Detach link!

Document.prototype.attachMasterLink = function(link) {
  this.attachLink(link)
  this.masterLink = link

  link.on('close', function() {
    this.masterLink = null
  }.bind(this))
}

Document.prototype.attachSlaveLink = function(link) {
  this.slaves.push(link)
  this.attachLink(link)
  
  link.on('close', function onclose() {
    this.slaves.splice(this.slaves.indexOf(link), 1)
  }.bind(this))
}

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
      this.masterLink.sendEdit(edit, function onack() {
        this.dispatchEdit(edit, link)
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
  
  try {
    
    // Check integrity of this edit
    if (!this.history.remembers(edit.parent)) {
      throw new Error('Edit "'+edit.id+'" has unknown parent "'+edit.parent+'"')
    }
    
    this.sanitizeEdit(edit, fromLink)
    this.applyEdit(edit, fromLink)
    
    // add to history
    this.history.pushEdit(edit) // XXX parent is wrong after all the transformations above
    
  }catch(er) {
    if(!fromLink) throw er // XXX In case of an error we can't just terminate the link, what if it's using us as a master link and just passing on an edit for us to verify?
    else fromLink.emit('error', er)
  }
  fromLink && fromLink.send('ack', edit.id)
  this.distributeEdit(edit, fromLink)
}

Document.prototype.sanitizeEdit = function(edit, fromLink) {

  if(this.masterLink === fromLink) {
    // nothing. We are not allowed to apply anything without consent from master, so we don't need to transform anything here
  }else if(~this.slaves.indexOf(fromLink)) {
    // Transform against possibly missed edits from history that have happened in the meantime
    this.history.getAllAfter(edit.parent)
      .forEach(function(oldEdit) {
        edit.follow(oldEdit)
      })
  }else{
  
    // Prune all edits from my history that the incoming edit doesn't know about
    var commonAnc = History.findNewestCommonAncestor(this.history.history, edit.ancestors)
      , latest = this.history.latest()
      
    var editToPrune = this.history.history.indexOf(commonAnc)+1
      , problematicRange = this.history.history.slice(editToPrune)
      , pruned = this.history.prune(this.history.history[editToPrune], problematicRange) // What if there's still an unknown edit in there? We have to make this recursive!
    
    pruned.push(edit) // Now, undo all ancestors of the incoming edit
    pruned.forEach(function(otherSitesEdit) {
      edit.substract(otherSitesEdit)
    })
    // and apply our history instead
    problematicRange.forEach(function(thisSitesEdit) {
      edit.follow(thisSitesEdit)
    })
    
    delete edit.ancestors
      
    /*
    var pruned = []
      , commonAnc
      , latest = this.history.latest()
      , editToPrune
    
    while((commonAnc = History.findNewestCommonAncestor(this.history.history, edit.ancestors)) !== latest) {// XXX Turn this.history.history into func call
      editToPrune = this.history.history.indexOf(commonAnc)+1
      pruned = pruned.concat(this.history.prune(this.history.history[editToPrune], this.history.history.slice(editToPrune)))
    }*/
    
    
  }
}

Document.prototype.applyEdit = function(edit, fromLink) {
  // apply changes
  console.log('Document: apply edit', edit)
  try {
    this.content = edit.changeset.apply(this.content)
  }catch(e) {
    throw new Error('Applying edit "'+edit.id+'" failed: '+e.message)
  }
}

Document.prototype.distributeEdit = function(edit, fromLink) {
  // forward edit
  this.links.forEach(function(link) {
    if(link === fromLink) return
    
    // XXX add ancestor to edit if this is a peer link
    link.sendEdit(edit)
  })
}