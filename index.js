// SPDX-FileCopyrightText: 2021 Anders Rune Jensen
//
// SPDX-License-Identifier: LGPL-3.0-only

const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const bfe = require('ssb-bfe')
const SSBURI = require('ssb-uri2')
const isCanonicalBase64 = require('is-canonical-base64')

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

  let contentSection = [content, contentSignature]
  if (content.recps) {
    contentSection = boxer(
      bfe.encode(author),
      bencode.encode(bfe.encode(contentSection)),
      bfe.encode(previous),
      content.recps
    )
  }

  const payload = [author, sequence, previous, timestamp, contentSection]
  const payloadBFE = bfe.encode(payload)
  const signature = ssbKeys.sign(keys, hmacKey, bencode.encode(payloadBFE))

  const msgBFE = bfe.encode([payload, signature])
  const bbmsg = bencode.encode(msgBFE)
  return bbmsg
}

/**
 * Calculate the message key for the given "msg value".
 *
 * @param {Object} msgVal an object compatible with ssb/classic `msg.value`
 * @returns {string} an SSB URI uniquely identifying the `msgVal`
 */
function hash(msgVal) {
  let data = ssbKeys.hash(encode(msgVal))
  if (data.endsWith('.sha256')) data = data.slice(0, -'.sha256'.length)
  return SSBURI.compose({ type: 'message', format: 'bendybutt-v1', data })
}

/**
 * Validate a decoded bendy-butt message value.
 *
 * @param {Object} msgVal - an object compatible with ssb/classic `msg.value`
 * @param {Object} previousMsg - a decoded `msgVal` object
 * @param {Buffer | string | null} hmacKey - a valid hmac key for signature verification
 * @returns {Object | undefined} an `Error` object with descriptive message or an `undefined` value for successful validation
 */
function validateSingle(msgVal, previousMsg, hmacKey) {
  const {
    author,
    sequence,
    previous,
    timestamp,
    signature,
    content,
    contentSignature,
  } = msgVal

  if (!SSBURI.isBendyButtV1FeedSSBURI(author))
    return new Error(
      `invalid message: author is "${author}", expected a valid feed identifier`
    )

  if (sequence < 1)
    return new Error(
      `invalid message: sequence is "${sequence}", expected a value greater than or equal to 1`
    )

  const previousErr = validatePrevious(author, sequence, previous, previousMsg)
  if (previousErr) return previousErr

  if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp))
    return new Error(
      `invalid message: timestamp is "${timestamp}", expected a 32 bit integer`
    )

  let contentSection = [content, contentSignature]
  if (content.recps) {
    contentSection = boxer(
      bfe.encode(author),
      bencode.encode(contentSection),
      bfe.encode(previous),
      content.recps
    )
  } else if (isBoxedString(content)) {
    contentSection = content
  }

  const payload = [author, sequence, previous, timestamp, contentSection]
  const payloadBFE = bfe.encode(payload)
  const payloadBen = bencode.encode(payloadBFE)

  const signatureErr = validateSignature(author, payloadBen, signature, hmacKey)
  if (signatureErr) return signatureErr

  // final encoding steps to allow byte-length check
  const msgBFE = bfe.encode([payload, signature])
  const bbmsg = bencode.encode(msgBFE)

  if (bbmsg.length > 8192)
    return new Error(
      `invalid message size: ${bbmsg.length} bytes, must not be greater than 8192 bytes`
    )
}

/**
 * Decode a bendy-butt message into an object useful for ssb-db and ssb-db2.
 * Performs message validation before returning the decoded message object.
 *
 * @param {Buffer} bbmsg a bendy-butt message encoded with `bencode`
 * @param {Object} previousMsg a decoded `msgVal` object
 * @param {Buffer | string | null} hmacKey a valid hmac key for signature verification
 * @returns {Object} an object compatible with ssb/classic `msg.value` or an `Error`
 */
function decodeAndValidateSingle(bbmsg, previousMsg, hmacKey) {
  if (bbmsg.length > 8192)
    return new Error(
      `invalid message size: ${bbmsg.length} bytes, must not be greater than 8192 bytes`
    )

  const msgBFE = bencode.decode(bbmsg)

  if (!Array.isArray(msgBFE) || msgBFE.length !== 2)
    return new Error(
      `invalid message: ${typeof msgBFE} with length ${
        msgBFE.length
      }, expected a list of payload and signature`
    )

  const typeFormatErr = validateTypeFormatData(msgBFE)
  if (typeFormatErr) return typeFormatErr

  const [payload, signature] = bfe.decode(msgBFE)

  if (!Array.isArray(payload) || payload.length !== 5)
    return new Error(
      `invalid message payload: ${typeof payload} with length ${
        payload.length
      }, expected a list of author, sequence, previous, timestamp and contentSection`
    )

  const [author, sequence, previous, timestamp, contentSection] = payload

  const previousErr = validatePrevious(author, sequence, previous, previousMsg)
  if (previousErr) return previousErr

  const payloadBen = bencode.encode(msgBFE[0])
  const signatureErr = validateSignature(author, payloadBen, signature, hmacKey)
  if (signatureErr) return signatureErr

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
    if (!(Array.isArray(contentSection) && contentSection.length === 2))
      return new Error(
        `invalid message: contentSection ${typeof contentSection} with length ${
          contentSection.length
        } is incorrect, expected a list of content and contentSignature`
      )

    const [content, contentSignature] = contentSection
    msgVal.content = content
    msgVal.contentSignature = contentSignature
  }

  return msgVal
}

/**
 * Verify that the top-level signature correctly signs the message payload.
 *
 * @param {string} author - Author ID for the message
 * @param {Buffer} payloadBen - Bencoded message payload containing a BFE-encoded list of `author, sequence, previous, timestamp, contentSection`
 * @param {string} signature - Base64-encoded signature for the given payload
 * @param {Buffer | string | null} hmacKey - HMAC key that was used to sign the payload
 * @returns {Object | undefined} Either an Error containing a message or an `undefined` value for successful verification
 */
function validateSignature(author, payloadBen, signature, hmacKey) {
  const hmacKeyErr = validateHmacKey(hmacKey)
  if (hmacKeyErr) return hmacKeyErr

  const isSignatureRx = isCanonicalBase64('', '\\.sig.\\w+')

  if (!isSignatureRx.test(signature))
    return new Error(
      `invalid message: signature "${signature}", expected a base64 string`
    )

  const { data } = SSBURI.decompose(author)
  if (
    !ssbKeys.verify(
      { public: data, curve: 'ed25519' },
      signature,
      hmacKey,
      payloadBen
    )
  )
    return new Error(
      'invalid message: signature must correctly sign the payload',
      author
    )
}

/**
 * Validate a message in relation to the previous message on the feed.
 *
 * @param {string} author - Author ID for the message
 * @param {number} sequence - Sequence number of the message being validated
 * @param {string | null} previous - Message ID of the previous message on the feed (`null` if `sequence` is `1`)
 * @param {Object | null} previousMsg - Previous message value as an object (`null` if `sequence` is `1`)
 * @returns {Object | undefined} Either an Error containing a message or an `undefined` value for successful validation
 */
function validatePrevious(author, sequence, previous, previousMsg) {
  if (sequence === 1) {
    if (previous !== null)
      return new Error(
        `invalid message: previous is "${previous}", expected a value of null because sequence is 1`
      )
  } else {
    if (!SSBURI.isBendyButtV1MessageSSBURI(previous))
      return new Error(
        `invalid message: previous is "${previous}", expected a valid message identifier`
      )
    if (!previousMsg)
      return new Error(
        'invalid previousMsg: value must not be undefined if sequence > 1'
      )
    if (author !== previousMsg.author)
      return new Error(
        `invalid message: author is "${author}" but previous message author is "${previousMsg.author}", expected values to be identical`
      )
    if (sequence !== previousMsg.sequence + 1)
      return new Error(
        `invalid message: sequence is ${sequence} but prevMsg sequence is ${previousMsg.sequence}, expected sequence to be prevMsg.sequence + 1`
      )

    const previousHash = hash(previousMsg)
    if (previous !== previousHash)
      return new Error(
        `invalid message: previous is "${previous}" but the computed hash of the previous message is "${previousHash}", expected values to be identical`
      )
  }
}

/**
 * Validate the BFE type-format-data encodings for the `author` and `previous` ID values.
 *
 * @param {Object} msgBFE - A BFE-encoded message value
 * @returns {Object | undefined} Either an Error containing a message or an `undefined` value for successful validation
 */
function validateTypeFormatData(msgBFE) {
  const payload = msgBFE[0]
  const [author, sequence, previous] = payload

  const authorTypeFormat = author.slice(0, 2).toString('hex')
  const previousTypeFormat = previous.slice(0, 2).toString('hex')

  if (authorTypeFormat !== '0003')
    return new Error(
      `invalid message: author type-format "0x${authorTypeFormat}" is incorrect, expected 0x0003`
    )

  if (sequence === 1) {
    if (previousTypeFormat !== '0602')
      return new Error(
        `invalid message: previous type-format "0x${previousTypeFormat}" is incorrect, expected 0x0602 (nil type-format) because sequence is 1`
      )
  } else {
    if (previousTypeFormat !== '0104')
      return new Error(
        `invalid message: previous type-format "0x${previousTypeFormat}" is incorrect, expected 0x0104`
      )
  }

  if (author.length !== 34)
    return new Error(
      `invalid message: author type-format-data length of ${author.length} bytes is incorrect, expected 34 bytes`
    )
}

/**
 * Validate an HMAC key.
 *
 * @param {Buffer | string | null | undefined} hmacKey
 * @returns {Object | undefined} Either an Error containing a message or an `undefined` value for successful validation
 */
function validateHmacKey(hmacKey) {
  if (hmacKey === undefined || hmacKey === null) return undefined

  const bytes = Buffer.isBuffer(hmacKey)
    ? hmacKey
    : Buffer.from(hmacKey, 'base64')

  if (typeof hmacKey === 'string') {
    if (bytes.toString('base64') !== hmacKey)
      return new Error(
        `invalid hmac key: "${hmacKey}", expected string to be base64 encoded`
      )
  }

  if (bytes.length !== 32)
    return new Error(
      `invalid hmac key: "${hmacKey}" with length ${hmacKey.length}, expected 32 bytes`
    )
}

module.exports = {
  decodeBox2,
  decode,
  encode,
  encodeNew,
  hash,
  decodeAndValidateSingle,
  validateSingle,
}
