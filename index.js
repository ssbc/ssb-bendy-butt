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
 * @param {number} timestamp when the message was created
 * @param {Buffer | null} hmacKey hmac key for signatures
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
  hmacKey,
  boxer
) {
  const author = keys.id
  const contentBFE = bfe.encode(content)
  const contentSignature = ssbKeys.sign(
    contentKeys || keys,
    hmacKey,
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
  const signature = ssbKeys.sign(keys, hmacKey, bencode.encode(payloadBFE))

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

/**
 * Decode a bendy-butt message into an object useful for ssb-db and ssb-db2.
 * Performs message validation before returning the decoded message object.
 *
 * @param {Buffer} bbmsg a bendy-butt message encoded with `bencode`
 * @returns {Object} an object compatible with ssb/classic `msg.value` or an `Error`
 */
function decodeAndValidateSingle(bbmsg, previousMsg, hmacKey) {
  if (bbmsg.length > 8192)
    return new Error('invalid message: length must not exceed 8192 bytes')

  const msgBFE = bencode.decode(bbmsg)

  if (!Array.isArray(msgBFE) || msgBFE.length !== 2)
    return new Error('invalid message: must be a list of payload and signature')

  const [payload, signature] = bfe.decode(msgBFE)

  if (!Array.isArray(payload) || payload.length !== 5)
    return new Error(
      'invalid payload: must be a list of author, sequence, previous, timestamp and contentSection'
    )

  const typeFormatErr = validateTypeFormat(msgBFE)
  if (typeFormatErr) return typeFormatErr

  const [author, sequence, previous, timestamp, contentSection] = payload

  const signatureErr = validateSignature(author, payload, signature, hmacKey)
  if (signatureErr) return signatureErr

  const previousErr = validatePrevious(author, sequence, previous, previousMsg)
  if (previousErr) return previousErr

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

function validateSignature(author, payload, signature, hmacKey) {
  const hmacKeyErr = validateHmacKey(hmacKey)
  if (hmacKeyErr) return hmacKeyErr

  if (!ssbKeys.verify(author, signature, hmacKey, payload))
    return new Error(
      'invalid message: signature must correctly sign the payload'
    )
}

function validatePrevious(author, sequence, previous, previousMsg) {
  if (sequence === 1) {
    if (previous !== null)
      return new Error(
        'invalid message: message must have a previous value of null if sequence is 1'
      )
  } else {
    const previousMsgAuthor = previousMsg[0]
    if (!previousMsg)
      return new Error(
        'invalid previousMsg: value must not be undefined if sequence > 1'
      )
    if (author !== previousMsgAuthor)
      return new Error(
        'invalid message: author must be the same for the current and previous messages'
      )

    const previousHash = hash(previousMsg)
    if (previous !== previousHash)
      return new Error(
        'invalid message: expected different previous message on feed'
      )
  }
}

function validateTypeFormat(msgBFE) {
  const payload = msgBFE[0]
  const [author, sequence, previous] = payload

  if (author.slice(0, 2).toString('hex') !== '0003')
    return new Error(
      'invalid message: author value must have the correct type-format'
    )

  if (sequence === 1) {
    if (previous.slice(0, 2).toString('hex') !== '0602')
      return new Error(
        'invalid message: previous value must have the nil type-format if sequence is 1'
      )
  } else {
    if (previous.slice(0, 2).toString('hex') !== '0104')
      return new Error(
        'invalid message: previous value must have the correct type-format'
      )
  }
}

function validateHmacKey(hmacKey) {
  if (hmacKey === undefined || hmacKey === null) return false

  const bytes = Buffer.isBuffer(hmacKey)
    ? hmacKey
    : Buffer.from(hmacKey, 'base64')

  if (typeof hmacKey === 'string') {
    if (bytes.toString('base64') !== hmacKey)
      return new Error('invalid hmac key: string must be base64 encoded')
  }

  if (bytes.length !== 32)
    return new Error('invalid hmac key: must have a length of 32 bytes')
}

module.exports = {
  decodeBox2,
  decode,
  encode,
  encodeNew,
  hash,
  decodeAndValidateSingle,
}
