const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const bfe = require('ssb-bfe')

function decodeBox2(box2) {
  const decoded = bencode.decode(box2)
  return bfe.decode(decoded)
}

/**
 * Decode a bendy-butt message into an object useful for ssb-db and ssb-db2.
 * Assumes the bendy-butt message has already been validated.
 *
 * @param {Buffer} bbmsg a bendy-butt message encoded with `bencode`
 * @returns {Object} an object compatible with ssb/classic `msg.value`
 */
function decode(bbmsg) {
  const [payload, signature] = bencode.decode(bbmsg)
  const [author, sequence, previous, timestamp, contentSection] = payload

  const result = {
    previous: bfe.decode(previous),
    author: bfe.decode(author),
    sequence: bfe.decode(sequence),
    timestamp: bfe.decode(timestamp),
    signature: bfe.decode(signature),
  }

  if (Array.isArray(contentSection)) {
    const [contentBFE, contentSignatureBFE] = contentSection
    Object.assign(result, {
      content: bfe.decode(contentBFE),
      contentSignature: bfe.decode(contentSignatureBFE),
    })
  }
  // box2
  else {
    const content = contentSection
    Object.assign(result, {
      content: bfe.decode(content),
    })
  }

  return result
}

/**
 * Encode a database "msg value" to a bendy-butt msg in a Buffer.
 *
 * @param {Object} msgVal an object compatible with ssb/classic `msg.value`
 * @returns {Buffer} a bendy-butt message encoded with `bencode`
 */
function encode(msgVal) {
  const contentSection =
    typeof msgVal.content === 'string' && msgVal.content.endsWith('.box2')
      ? bfe.encodeBendyButt(msgVal.content)
      : [
          bfe.encodeBendyButt(msgVal.content),
          bfe.encodeBendyButt(msgVal.contentSignature),
        ]

  return bencode.encode([
    [
      bfe.encodeBendyButt(msgVal.author),
      bfe.encodeBendyButt(msgVal.sequence),
      bfe.encodeBendyButt(msgVal.previous),
      bfe.encodeBendyButt(msgVal.timestamp),
      contentSection,
    ],
    bfe.encodeBendyButt(msgVal.signature),
  ])
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
  const contentBFE = bfe.encodeBendyButt(content)
  const contentSignature = ssbKeys.sign(sfKeys, bencode.encode(contentBFE))
  const contentSignatureBFE = bfe.encodeBendyButt(contentSignature)

  let contentSection = [contentBFE, contentSignatureBFE]

  if (content.recps)
    contentSection = boxer(
      bfe.encodeBendyButt(mfKeys.id),
      bencode.encode(contentSection),
      bfe.encodeBendyButt(previous),
      content.recps
    )

  const payload = [
    mfKeys.public,
    sequence + 1,
    previous,
    timestamp,
    contentSection,
  ]

  const payloadBFE = bfe.encodeBendyButt(payload)
  const payloadSignature = ssbKeys.sign(mfKeys, bencode.encode(payloadBFE))
  const payloadSignatureBFE = bfe.encodeBendyButt(payloadSignature)

  const msgVal = {
    previous,
    author: mfKeys.id,
    sequence,
    timestamp,
    signature: bfe.decode(payloadSignatureBFE),
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
