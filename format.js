// SPDX-FileCopyrightText: 2022 Andre 'Staltz' Medeiros
//
// SPDX-License-Identifier: LGPL-3.0-only

const bencode = require('bencode')
const BFE = require('ssb-bfe')
const ssbKeys = require('ssb-keys')
const SSBURI = require('ssb-uri2')

const CONTENT_SIG_PREFIX = Buffer.from('bendybutt', 'utf8')

const feedFormat = {
  name: 'bendybutt-v1',
  encodings: ['js'],

  getFeedId(nativeMsg) {
    return BFE.decode(bencode.decode(nativeMsg, 2, 39))
  },

  _msgIdCache: new Map(),
  _extractCache: new Map(),

  getMsgId(nativeMsg) {
    if (feedFormat._msgIdCache.has(nativeMsg)) {
      return feedFormat._msgIdCache.get(nativeMsg)
    }
    let data = ssbKeys.hash(nativeMsg)
    if (data.endsWith('.sha256')) data = data.slice(0, -'.sha256'.length)
    const msgId = SSBURI.compose({
      type: 'message',
      format: 'bendybutt-v1',
      data,
    })
    feedFormat._msgIdCache.set(nativeMsg, msgId)
    return msgId
  },

  getSequence(nativeMsg) {
    const { sequence } = feedFormat._extract(nativeMsg)
    return sequence
  },

  isNativeMsg(x) {
    if (!Buffer.isBuffer(x)) return false
    if (x.length === 0) return false
    try {
      const { authorBFE } = feedFormat._extract(x)
      return BFE.isEncodedFeedBendybuttV1(authorBFE)
    } catch (err) {
      return false
    }
  },

  isAuthor(author) {
    return typeof author === 'string' && SSBURI.isBendyButtV1FeedSSBURI(author)
  },

  toPlaintextBuffer(opts) {
    const { content, contentKeys, keys, hmacKey } = opts
    const contentBFE = BFE.encode(content)
    const contentSignature = ssbKeys.sign(
      contentKeys || keys,
      hmacKey,
      Buffer.concat([CONTENT_SIG_PREFIX, bencode.encode(contentBFE)])
    )
    const contentSection = [content, contentSignature]
    return bencode.encode(BFE.encode(contentSection))
  },

  _extract(nativeMsg) {
    if (feedFormat._extractCache.has(nativeMsg)) {
      return feedFormat._extractCache.get(nativeMsg)
    }
    const [payload, signatureBFE] = bencode.decode(nativeMsg)
    const [authorBFE, sequence, previousBFE, timestamp, contentSection] =
      payload
    const extracted = {
      payload,
      signatureBFE,
      authorBFE,
      sequence,
      previousBFE,
      timestamp,
      contentSection,
    }
    feedFormat._extractCache.set(nativeMsg, extracted)
    return extracted
  },

  newNativeMsg(opts) {
    const author = opts.keys.id
    const previous = opts.previous || { key: null, value: { sequence: 0 } }
    const sequence = previous.value.sequence + 1
    const previousId = previous.key
    const timestamp = +opts.timestamp
    const content = opts.content
    const contentBFE = BFE.encode(content)
    const contentSignature = ssbKeys.sign(
      opts.contentKeys || opts.keys,
      opts.hmacKey,
      Buffer.concat([CONTENT_SIG_PREFIX, bencode.encode(contentBFE)])
    )
    let contentSection = [content, contentSignature]
    const payload = [author, sequence, previousId, timestamp, contentSection]
    const payloadBen = bencode.encode(BFE.encode(payload))
    const signature = ssbKeys.sign(opts.keys, opts.hmacKey, payloadBen)
    return bencode.encode(BFE.encode([payload, signature]))
  },

  fromNativeMsg(nativeMsg, encoding = 'js') {
    if (encoding === 'js') {
      const msgBFE = bencode.decode(nativeMsg)
      const [payload, signature] = BFE.decode(msgBFE)
      const [author, sequence, previous, timestamp, contentSection] = payload

      const msgVal = {
        author,
        sequence,
        previous,
        timestamp,
        signature,
      }
      if (typeof contentSection === 'string') {
        msgVal.content = contentSection
      } else {
        const [content, contentSignature] = contentSection
        msgVal.content = content
        msgVal.contentSignature = contentSignature
      }

      return msgVal
    } else {
      // prettier-ignore
      throw new Error(`Feed format "${feedFormat.name}" does not support encoding "${encoding}"`)
    }
  },

  fromDecryptedNativeMsg(plaintextBuf, nativeMsg, encoding = 'js') {
    if (encoding === 'js') {
      const msgVal = feedFormat.fromNativeMsg(nativeMsg, encoding)
      const contentSection = BFE.decode(bencode.decode(plaintextBuf))
      const [content, contentSignature] = contentSection
      msgVal.content = content
      msgVal.contentSignature = contentSignature
      return msgVal
    } else {
      // prettier-ignore
      throw new Error(`Feed format "${feedFormat.name}" does not support encoding "${encoding}"`)
    }
  },

  toNativeMsg(msg, encoding = 'js') {
    if (encoding === 'js') {
      const {
        author,
        sequence,
        previous,
        timestamp,
        signature,
        content,
        contentSignature,
      } = msg
      const contentSection =
        typeof content === 'string' ? content : [content, contentSignature]
      const payload = [author, sequence, previous, timestamp, contentSection]
      const msgBFE = BFE.encode([payload, signature])
      const nativeMsg = bencode.encode(msgBFE)
      return nativeMsg
    } else {
      // prettier-ignore
      throw new Error(`Feed format "${feedFormat.name}" does not support encoding "${encoding}"`)
    }
  },

  validate(nativeMsg, prevNativeMsg, hmacKey, cb) {
    const {
      _extract,
      _validateSize,
      _validatePrevious,
      _validateFirstPrevious,
      _validateHmac,
      _validateAuthor,
      _validateSequence,
      _validateTimestamp,
      _validateContentSection,
      _validateShape,
      _validateSignature,
    } = feedFormat

    let err
    if ((err = _validateShape(nativeMsg))) return cb(err)
    if ((err = _validateHmac(hmacKey))) return cb(err)
    if ((err = _validateSize(nativeMsg))) return cb(err)

    const {
      authorBFE,
      sequence,
      previousBFE,
      timestamp,
      payload,
      contentSection,
      signatureBFE,
    } = _extract(nativeMsg)

    if ((err = _validateAuthor(authorBFE))) return cb(err)

    if (sequence === 1) {
      if ((err = _validateFirstPrevious(previousBFE, prevNativeMsg)))
        return cb(err)
    } else {
      if ((err = _validatePrevious(previousBFE, prevNativeMsg))) return cb(err)
      if ((err = _validateSequence(sequence, prevNativeMsg))) return cb(err)
    }

    if ((err = _validateTimestamp(timestamp))) return cb(err)

    if ((err = _validateSignature(signatureBFE, authorBFE, payload, hmacKey)))
      return cb(err)

    if ((err = _validateContentSection(contentSection))) return cb(err)

    cb()
  },

  _validateShape(nativeMsg) {
    if (!Buffer.isBuffer(nativeMsg)) {
      return new Error(`invalid message: expected a buffer`)
    }
    const topLayer = bencode.decode(nativeMsg)
    if (!Array.isArray(topLayer) || topLayer.length !== 2) {
      return new Error(`invalid message: expected a bencode list of length 2`)
    }
    const [payload] = topLayer
    const layer2 = payload
    if (!Array.isArray(layer2) || layer2.length !== 5) {
      // prettier-ignore
      return new Error(`invalid message: expected payload to be a bencode list of length 5`)
    }
  },

  _validateSize(nativeMsg) {
    if (nativeMsg.length > 8192) {
      // prettier-ignore
      return new Error(`invalid message size: ${nativeMsg.length} bytes, must not be greater than 8192 bytes`)
    }
  },

  _validateAuthor(authorBFE) {
    if (!Buffer.isBuffer) {
      return new Error(`invalid message: expected author to be a buffer`)
    }
    if (!BFE.isEncodedFeedBendybuttV1(authorBFE)) {
      // prettier-ignore
      return new Error(`invalid message: author is ${authorBFE.toString('hex')}, must be bendybutt v1 feed`)
    }
  },

  _validateHmac(hmacKey) {
    if (!hmacKey) return
    if (typeof hmacKey !== 'string' && !Buffer.isBuffer(hmacKey)) {
      return new Error('invalid hmac key: must be a string or buffer')
    }
    const bytes = Buffer.isBuffer(hmacKey)
      ? hmacKey
      : Buffer.from(hmacKey, 'base64')

    if (typeof hmacKey === 'string' && bytes.toString('base64') !== hmacKey) {
      return new Error('invalid hmac')
    }

    if (bytes.length !== 32) {
      return new Error('invalid hmac, it should have 32 bytes')
    }
  },

  /**
   * Validate a message in relation to the previous message on the feed.
   *
   * @param {Buffer} previousBFE - Message ID of the previous message on
   * the feed (`null` if `sequence` is `1`) encoded in BFE.
   * @param {Buffer | null} prevNativeMsg - Previous message value as an object
   * (`null` if `sequence` is `1`).
   * @returns {Object | undefined} Either an Error containing a message or an
   * `undefined` value for successful validation.
   */
  _validatePrevious(previousBFE, prevNativeMsg) {
    if (!Buffer.isBuffer(previousBFE)) {
      return new Error(`invalid message: expected previous to be a buffer`)
    }
    if (!BFE.isEncodedMessageBendybuttV1(previousBFE)) {
      // prettier-ignore
      return new Error(`invalid message: previous is "${previousBFE.toString('hex')}", expected a valid message identifier`)
    }
    if (!prevNativeMsg) {
      // prettier-ignore
      return new Error('invalid previousMsg: value must not be undefined if sequence > 1')
    }
    const prevMsgId = feedFormat.getMsgId(prevNativeMsg)
    if (!previousBFE.equals(BFE.encode(prevMsgId))) {
      // prettier-ignore
      return new Error(`invalid message: previousBFE is "${previousBFE.toString('hex')}" but previous message author is "${prevMsgId}", expected values to be identical`)
    }
  },

  _validateSequence(sequence, prevNativeMsg) {
    if (!prevNativeMsg) {
      // prettier-ignore
      return new Error(`invalid message: sequence is ${sequence}, expected 1 because there is no previous message`)
    }
    const prevSequence = feedFormat.getSequence(prevNativeMsg)
    if (sequence !== prevSequence + 1) {
      // prettier-ignore
      return new Error(`invalid message: sequence is ${sequence} but prevMsg sequence is ${prevSequence}, expected sequence to be prevMsg.sequence + 1`)
    }
  },

  _validateTimestamp(timestamp) {
    if (
      typeof timestamp !== 'number' ||
      isNaN(timestamp) ||
      !isFinite(timestamp) ||
      timestamp < 0
    ) {
      // prettier-ignore
      return new Error(`invalid message: timestamp is ${timestamp}, expected a non-negative number`)
    }
  },

  _validateFirstPrevious(previousBFE, prevNativeMsg) {
    if (!Buffer.isBuffer(previousBFE)) {
      return new Error(`invalid message: expected previous to be a buffer`)
    }
    if (!BFE.isEncodedGenericNil(previousBFE)) {
      // prettier-ignore
      return new Error(`invalid message: previous is "${previousBFE.toString('hex')}", expected a value of null because sequence is 1`)
    }
    if (prevNativeMsg) {
      // prettier-ignore
      return new Error('invalid message: sequence cannot be 1 if there exists a previous message')
    }
  },

  _validateContentSection(contentSection) {
    if (!contentSection) {
      return new Error('invalid message: contentSection is missing')
    }
    if (!Array.isArray(contentSection) || contentSection.length !== 2) {
      // prettier-ignore
      return new Error('invalid message: contentSection should be an array with two items')
    }
    const [content, contentSignature] = contentSection
    if (!content || typeof content !== 'object') {
      // prettier-ignore
      return new Error('invalid message: content should be an object')
    }
    if (!Buffer.isBuffer(contentSignature)) {
      return new Error('invalid message: contentSignature should be a buffer')
    }
    if (!BFE.isEncodedSignatureMsgEd25519(contentSignature)) {
      // prettier-ignore
      return new Error('invalid message: contentSignature expected to be a valid BFE signature buffer')
    }
  },

  _validateSignature(signatureBFE, authorBFE, payload, hmacKey) {
    if (!Buffer.isBuffer(signatureBFE)) {
      return new Error(`invalid message: expected signature to be a buffer`)
    }
    if (!BFE.isEncodedSignatureMsgEd25519(signatureBFE)) {
      // prettier-ignore
      return new Error(`invalid message: signature, expected a valid BFE signature buffer`)
    }
    const signature = signatureBFE.slice(2)
    const public = authorBFE.slice(2).toString('base64') + '.ed25519'
    const keys = { public, curve: 'ed25519' }
    const payloadBen = bencode.encode(payload)
    if (
      !ssbKeys.verify(keys, signature.toString('base64'), hmacKey, payloadBen)
    ) {
      // prettier-ignore
      return new Error('invalid message: signature by must correctly sign the payload')
    }
  },
}

module.exports = feedFormat
