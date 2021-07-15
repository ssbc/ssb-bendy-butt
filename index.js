const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const bfe = require('ssb-bfe')

function decodeBox2(box2) {
  const decoded = bencode.decode(box2)
  return bfe.decode(decoded)
}

function isBoxedString(x) {
  return typeof x === 'string' && x.endsWith('.box2')
}

/**
 * Decode a bendy-butt message into an object useful for ssb-db and ssb-db2.
 * Assumes the bendy-butt message has already been validated.
 *
 * @param {Buffer} bbmsg a bendy-butt message encoded with `bencode`
 * @returns {Object} an object compatible with ssb/classic `msg.value`
 */
function decode(bbmsg) {
  const msgBFE = bencode.decode(bbmsg)
  const [payload, signature] = bfe.decode(msgBFE)
  const [author, sequence, previous, timestamp, contentSection] = payload

  const msgVal = {
    author,
    sequence,
    previous,
    timestamp,
    signature,
  }
  if (isBoxedString(contentSection)) {
    msgVal.content = contentSection
  } else {
    const [content, contentSignature] = contentSection
    msgVal.content = content
    msgVal.contentSignature = contentSignature
  }

  return msgVal
}

/**
 * Encode a database "msg value" to a bendy-butt msg in a Buffer.
 *
 * @param {Object} msgVal an object compatible with ssb/classic `msg.value`
 * @returns {Buffer} a bendy-butt message encoded with `bencode`
 */
function encode(msgVal) {
  const {
    author,
    sequence,
    previous,
    timestamp,
    signature,
    content,
    contentSignature,
  } = msgVal

  const contentSection = isBoxedString(content)
    ? content
    : [content, contentSignature]

  const payload = [author, sequence, previous, timestamp, contentSection]

  const msgBFE = bfe.encode([payload, signature])
  const bbmsg = bencode.encode(msgBFE)
  return bbmsg
}

/**
 * Creates a new bendy-butt message that can be appended to a bendy-butt feed.
 *
 * FIXME: this method does not seem to belong to `ssb-bendy-butt` because it is
 * aware of the metafeed spec (requiring mfKeys and sfKeys). Perhaps this should
 * be moved to `ssb-meta-feeds`?
 *
 * @param {Object} content an arbitrary object comprising the message contents
 * @param {import('ssb-keys').Keys} mfKeys the keys object of the metafeed
 * @param {import('ssb-keys').Keys} sfKeys the keys object for the subfeed
 * @param {string | null} previous msg ID of the previous bendy-butt msg in the
 * feed
 * @param {number} sequence sequence number of the new msg to be created
 * @param {number} timestamp timestamp for the new msg to be created
 * @param {function | undefined} boxer function to encrypt the contents
 * @returns {Object} an object compatible with ssb/classic `msg.value`
 */
function create(content, mfKeys, sfKeys, previous, sequence, timestamp, boxer) {
  const author = mfKeys.id
  const contentBFE = bfe.encode(content)
  const contentSignature = ssbKeys.sign(sfKeys, bencode.encode(contentBFE))
  const contentSignatureBFE = bfe.encode(contentSignature)

  let contentSection = [contentBFE, contentSignatureBFE]

  if (content.recps)
    contentSection = boxer(
      bfe.encode(author),
      bencode.encode(contentSection),
      bfe.encode(previous),
      content.recps
    )

  const payload = [author, sequence, previous, timestamp, contentSection]
  const payloadBFE = bfe.encode(payload)
  const signature = ssbKeys.sign(mfKeys, bencode.encode(payloadBFE))

  const msgVal = {
    author,
    sequence,
    previous,
    timestamp,
    signature,
  }

  if (content.recps) {
    Object.assign(msgVal, {
      content: contentSection,
    })
  } else {
    Object.assign(msgVal, {
      content,
      contentSignature: bfe.decode(contentSignatureBFE),
    })
  }

  return msgVal
}

// msg must be a classic compatible msg
function hash(msg) {
  return '%' + ssbKeys.hash(encode(msg)).replace('.sha256', '.bbmsg-v1')
}

// FIXME: might split this out and add validateBatch
function validateSingle(bmsg, previous) {}

module.exports = {
  decodeBox2,
  decode,
  encode,
  create,
  hash,
}
