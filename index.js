const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const bfe = require('ssb-bfe')

const CONTENT_SIG_PREFIX = Buffer.from('bendybutt', 'utf8')

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
 * @callback Boxer
 * @param {Buffer} bbAuthor author feed ID, encoded in `bencode` and BFE
 * @param {Buffer} bbContentSection content-and-signature tuple, encoded in
 * `bencode` and BFE
 * @param {Buffer} bbPrevious previous message ID, encoded in `bencode` and BFE
 * @param {Array} recps an Array of recipient IDs
 * @returns {string} a ciphertext (i.e. "boxed") string, suffixed with `.box2`
 */

/**
 *
 * @param {Object} content an arbitrary object content the message contents
 * @param {import('ssb-keys').Keys | null} contentKeys the keys object of the
 * author to use for signing the content. May be different from `keys`.
 * @param {import('ssb-keys').Keys} keys the keys object of the author, to use
 * for signing the payload.
 * @param {number} sequence sequence number of the new msg to be created
 * @param {string | null} previous msg ID of the previous bendy-butt msg in the
 * feed
 * @param {number} timestamp timestamp for the new msg to be created
 * @param {Boxer | undefined} boxer function to encrypt the contents
 * @returns {Buffer} a bendy-butt message encoded with `bencode`
 */
function encodeNew(
  content,
  contentKeys,
  keys,
  sequence,
  previous,
  timestamp,
  boxer
) {
  const author = keys.id
  const contentBFE = bfe.encode(content)
  const contentSignature = ssbKeys.sign(
    contentKeys || keys,
    Buffer.concat([CONTENT_SIG_PREFIX, bencode.encode(contentBFE)])
  )
  const contentSignatureBFE = bfe.encode(contentSignature)

  let contentSection = [contentBFE, contentSignatureBFE]
  if (content.recps) {
    contentSection = boxer(
      bfe.encode(author),
      bencode.encode(contentSection),
      bfe.encode(previous),
      content.recps
    )
  }

  const payload = [author, sequence, previous, timestamp, contentSection]
  const payloadBFE = bfe.encode(payload)
  const signature = ssbKeys.sign(keys, bencode.encode(payloadBFE))

  const msgBFE = bfe.encode([payloadBFE, signature])
  const bbmsg = bencode.encode(msgBFE)
  return bbmsg
}

/**
 * Calculate the message key for the given "msg value".
 *
 * @param {Object} msgVal an object compatible with ssb/classic `msg.value`
 * @returns {string} a sigil-based string uniquely identifying the `msgVal`
 */
function hash(msgVal) {
  return '%' + ssbKeys.hash(encode(msgVal)).replace('.sha256', '.bbmsg-v1')
}

// FIXME: might split this out and add validateBatch
function validateSingle(bmsg, previous) {}

module.exports = {
  decodeBox2,
  decode,
  encode,
  encodeNew,
  hash,
}
