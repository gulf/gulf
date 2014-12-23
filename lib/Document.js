var Link = require('./Link')
  , Edit = require('./Edit')
  , History = require('./History')

function Document(ottype) {
  this.ottype = ottype
  this.content = null
  this.history = new History
  this.slaves = []
  this.links = []
  this.master = null

  if(!this.ottype) throw new Error('Document: No ottype specified')
}

module.exports = Document

/**
 * Creates a new document
 */
Document.create = function(ottype, content) {
  var doc = new Document(ottype)
  doc.content = content
  doc.history.pushEdit(Edit.newInitial(ottype))
  return doc
}

/**
 * Creates a new Link and attaches it as a slave
 */
Document.prototype.slaveLink = function() {
  var link = new Link
  this.attachSlaveLink(link)
  return link
}

/**
 * Creates a new Link and attaches it as master
 * (You will want to listen to the link's 'close' event)
 */
Document.prototype.masterLink = function() {
  var link = new Link
  this.attachMasterLink(link)
  return link
}

// XXX Detach link!

/**
 * Attaches a link as master
 */
Document.prototype.attachMasterLink = function(link) {
  this.master = link
  this.attachLink(link)

  link.on('close', function() {
    this.master = null
  }.bind(this))
}

/**
 * Attaches a link as a slave
 */
Document.prototype.attachSlaveLink = function(link) {
  this.slaves.push(link)
  this.attachLink(link)

  link.on('close', function onclose() {
    this.slaves.splice(this.slaves.indexOf(link), 1)
  }.bind(this))
}

Document.prototype.attachLink = function(link) {
  if(~this.links.indexOf(link)) return;

  this.links.push(link)

  // Other end requests init? can do.
  link.on('link:requestInit', function() {
    if(null === this.content) {
      return // I don't know either!
    }
    link.send('init', {content: this.content, initialEdit: this.history.latest().pack()})
  }.bind(this))

  // Other side sends init.
  link.on('link:init', function(data) {
    this.receiveInit(data, link)
  }.bind(this))

  // Other side sends edit.
  link.on('link:edit', function onedit(edit) {
    this.receiveEdit(edit, link)
  }.bind(this))

  link.on('close', function onclose() {
    this.links.splice(this.links.indexOf(link), 1)
  }.bind(this))

  // If we don't know the document yet, request its content
  if(null === this.content) link.send('requestInit')
}

/**
 * Receive init
 *
 * @param data {Object} Example: {content: "", initialEdit: <Edit..>}
 */
Document.prototype.receiveInit = function(data, fromLink) {
  // I'm master? Don't go bossing me around!
  if(!this.master || fromLink !== this.master) return

  var content = data.content
    , initialEdit = data.initialEdit

  initialEdit = Edit.unpack(initialEdit, this.ottype)

  this.content = content
  this.history.reset()
  this.history.pushEdit(initialEdit)

  // I got an init, so my slaves get one, too
  this.slaves.forEach(function(slave) {
    slave.send('init', {content: this.content, initialEdit: this.history.latest().pack()})
  }.bind(this))
}

/**
 * Receive an edit
 *
 * @param edit <Edit>
 * @paramfromLink <Link>
 */
Document.prototype.receiveEdit = function(edit, fromLink) {
  if (!this.master || fromLink === this.master) {
    // Edit comes from master, or even better: we are master, yea baby!
    this.dispatchEdit(Edit.unpack(edit, this.ottype), fromLink)
  }else {
    // check with master first
    this.master.sendEdit(edit, function onack() {
      this.dispatchEdit(edit, fromLink)
    }.bind(this))
  }
}

/**
 * Dispatch a received edit
 *
 * @param edit <Edit>
 * @param fromLink <Link> (optional>
 */
Document.prototype.dispatchEdit = function(edit, fromLink) {
  if (this.history.remembers(edit.id)) {
    // We've got this edit already.
    if(fromLink) fromLink.send('ack', edit.id)
    return
  }

  try {

    // Check integrity of this edit
    if (!this.history.remembers(edit.parent)) {
      throw new Error('Edit "'+edit.id+'" has unknown parent "'+edit.parent+'"')
    }

    this.applyEdit(this.sanitizeEdit(edit, fromLink))

  }catch(er) {
    if(!fromLink) throw er // XXX: In case of an error we can't just terminate the link,
                           //      what if it's using us as a master link and just passing on an
                           //      edit for us to verify?

    fromLink.emit('error', er) // ^^
  }

  if(fromLink) fromLink.send('ack', edit.id)
  this.distributeEdit(edit, fromLink)
}

/**
 * Returns an edit that is able to be applied
 */
Document.prototype.sanitizeEdit = function(edit, fromLink) {

  if(this.master === fromLink) {
    // We are not allowed to apply anything without consent from master anyway,
    // so we don't need to transform anything coming from master.

    // add to history + set id
    this.history.pushEdit(edit)

    return edit
  }else {
    // We are master!

    // Transform against missed edits from history that have happened in the meantime
    var missed = this.history.getAllAfter(edit.parent)
    missed.forEach(function(oldEdit) {
      edit.follow(oldEdit)
    })

    // add to history + set id
    this.history.pushEdit(edit)

    return edit

  }
}

Document.prototype.applyEdit = function(edit) {
  // apply changes
  console.log('Document: apply edit', edit)
  try {
    this.content = edit.apply(this.content)
  }catch(e) {
    throw new Error('Applying edit "'+edit.id+'" failed: '+e.message)
  }
}

Document.prototype.distributeEdit = function(edit, fromLink) {
  // forward edit
  this.links.forEach(function(link) {
    if(link === fromLink) return

    link.sendEdit(edit)
  })
}
