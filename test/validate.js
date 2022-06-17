// SPDX-FileCopyrightText: 2021 Anders Rune Jensen
//
// SPDX-License-Identifier: Unlicense

const tape = require('tape')
const fs = require('fs')
const bencode = require('bencode')
const bfe = require('ssb-bfe')
const pify = require('util').promisify
const bendybutt = require('../format')

const vec = JSON.parse(
  fs.readFileSync('test/testvector-metafeed-managment.json', 'utf8')
)

const badVec = JSON.parse(
  fs.readFileSync('test/testvector-metafeed-bad-messages.json', 'utf8')
)

function entryToMsgValue(entry) {
  const { Author, Sequence, Previous, Timestamp, Signature } = entry
  let [content, contentSignature] = entry.HighlevelContent
  if (typeof content.nonce === 'string') {
    content.nonce = Buffer.from(content.nonce, 'base64')
  }
  contentSignature = bfe.decode(Buffer.from(contentSignature.HexString, 'hex'))
  const signature = bfe.decode(Buffer.from(Signature, 'hex'))

  return {
    author: Author,
    sequence: Sequence,
    previous: Previous,
    timestamp: Timestamp,
    content,
    contentSignature,
    signature,
  }
}

tape('validation on good vectors and some corruptions', async (t) => {
  const msg1 = entryToMsgValue(vec.Entries[0])
  const msg2 = entryToMsgValue(vec.Entries[1])
  const msg3 = entryToMsgValue(vec.Entries[2])

  const nativeMsg1 = bendybutt.toNativeMsg(msg1)
  const nativeMsg2 = bendybutt.toNativeMsg(msg2)
  const nativeMsg3 = bendybutt.toNativeMsg(msg3)

  t.pass('[ basic tests ]')

  try {
    await pify(bendybutt.validate)(nativeMsg1, null, null)
  } catch (err) {
    t.fail(err)
  }
  t.pass('validates 1st message (seq 1) without previous')

  try {
    await pify(bendybutt.validate)(nativeMsg2, nativeMsg1, null)
  } catch (err) {
    t.fail(err)
  }
  t.pass('validates 2nd message with previous')

  try {
    await pify(bendybutt.validate)(nativeMsg3, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid previousMsg\: value must not be undefined/,
      'catches missing previous msg'
    )
  }

  // change sequence to align with msg3
  const corruptNativeMsg1 = bendybutt.toNativeMsg({ ...msg1, sequence: 2 })
  try {
    await pify(bendybutt.validate)(nativeMsg3, corruptNativeMsg1, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previousBFE is/,
      'catches incorrect previous msg hash'
    )
  }

  const corruptNativeMsg3 = bendybutt.toNativeMsg({
    ...msg2,
    author:
      'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=',
  })
  try {
    await pify(bendybutt.validate)(corruptNativeMsg3, nativeMsg2, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previousBFE is .* but previous message author is/,
      'catches incorrect previous msg author'
    )
  }

  const hmacKey = Buffer.from('not a valid hmac key')
  try {
    await pify(bendybutt.validate)(nativeMsg2, nativeMsg1, hmacKey)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid hmac, it should have 32 bytes/,
      'catches invalid hmac (not base64 encoded)'
    )
  }

  // change the first character of the signature to invalidate it ('G' -> 'Z')
  const wrongSignedMsg = bendybutt.toNativeMsg({
    ...msg1,
    signature:
      'ZkuHYMetsUCVXzM70u7grRBrVYjdo35EGl/Gr8wq4yis+5WND4WACanaDQpVGn4H0lmqmb87gDT9UdSF9STyDg==.sig.ed25519',
  })
  try {
    await pify(bendybutt.validate)(wrongSignedMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: signature by must correctly sign the payload/,
      'catches invalid signature (altered first character)'
    )
  }

  const wrongMsgShape = bencode.encode(['one', 'two', 'three'])
  try {
    await pify(bendybutt.validate)(wrongMsgShape, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: expected a bencode list of length 2/,
      'catches invalid message length (too many items in list)'
    )
  }

  const wrongPayloadShape = bencode.encode([[1, 2, 3, 4], 10])
  try {
    await pify(bendybutt.validate)(wrongPayloadShape, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: expected payload to be a bencode list of length 5/,
      'catches invalid payload length (too few items in list)'
    )
  }

  const bigMsg = bencode.encode([[1, 2, 3, 4, 5], Buffer.alloc(8888)])
  try {
    await pify(bendybutt.validate)(bigMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message size: \d+ bytes, must not be greater than 8192 bytes/,
      'catches invalid message size (too big)'
    )
  }

  let badAuthorMsg = bencode.decode(nativeMsg1)
  badAuthorMsg[0][0] = Buffer.from([0, 1, 11, 22, 33, 44]) // gabbygrove feed
  badAuthorMsg = bencode.encode(badAuthorMsg)
  try {
    await pify(bendybutt.validate)(badAuthorMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: author is .*, must be bendybutt v1 feed/,
      'catches invalid BFE type-format for msg author'
    )
  }

  let badPreviousMsg = bencode.decode(nativeMsg1)
  badPreviousMsg[0][2] = Buffer.from([1, 1, 11, 22, 33, 44]) // gabbygrove msg
  badPreviousMsg = bencode.encode(badPreviousMsg)
  try {
    await pify(bendybutt.validate)(badPreviousMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previous is .*, expected a value of null because sequence is 1/,
      'catches invalid BFE type-format for previous (sequence == 1)'
    )
  }

  let badPreviousMsg2 = bencode.decode(nativeMsg2)
  badPreviousMsg2[0][2] = Buffer.from([1, 1, 11, 22, 33, 44]) // gabbygrove msg
  badPreviousMsg2 = bencode.encode(badPreviousMsg2)
  try {
    await pify(bendybutt.validate)(badPreviousMsg2, nativeMsg1, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previous is .*, expected a valid message identifier/,
      'catches invalid BFE type-format for previous (sequence > 1)'
    )
  }

  t.end()
})

tape('validation on bad vectors', async (t) => {
  /* --------------------------------------------------- */
  /* tests using `testvector-metafeed-bad-messages.json` */
  /* --------------------------------------------------- */

  t.pass('[ vector tests ]')

  const badAuthorTypeMsg = Buffer.from(
    badVec.Cases[0].Entries[0].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badAuthorTypeMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: author is .*, must be bendybutt v1 feed/,
      'catches invalid author (TFD type)'
    )
  }

  const badAuthorFormatMsg = Buffer.from(
    badVec.Cases[1].Entries[0].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badAuthorFormatMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: author is .*, must be bendybutt v1 feed/,
      'catches invalid author (TFD format)'
    )
  }

  const badAuthorLengthMsg = Buffer.from(
    badVec.Cases[2].Entries[0].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badAuthorLengthMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: author is .*, must be bendybutt v1 feed/,
      'catches invalid author (TFD length)'
    )
  }

  const bptPrev = Buffer.from(badVec.Cases[3].Entries[0].EncodedData, 'hex')
  const badPreviousTypeMsg = Buffer.from(
    badVec.Cases[3].Entries[1].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badPreviousTypeMsg, bptPrev, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previous is .*, expected a valid message identifier/,
      'catches invalid previous (TFD type)'
    )
  }

  const bpfPrev = Buffer.from(badVec.Cases[4].Entries[0].EncodedData, 'hex')
  const badPreviousFormatMsg = Buffer.from(
    badVec.Cases[4].Entries[1].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badPreviousFormatMsg, bpfPrev, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previous is .*, expected a valid message identifier/,
      'catches invalid previous (TFD format)'
    )
  }

  const bplPrev = Buffer.from(badVec.Cases[5].Entries[0].EncodedData, 'hex')
  const badPreviousLengthMsg = Buffer.from(
    badVec.Cases[5].Entries[1].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badPreviousLengthMsg, bplPrev, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previous is .*, expected a valid message identifier/,
      'catches invalid previous (hash mismatch; length)'
    )
  }

  const badPreviousTypeFormatMsg = Buffer.from(
    badVec.Cases[6].Entries[0].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badPreviousTypeFormatMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previous is .*, expected a value of null because sequence is 1/,
      'catches invalid previous (should be null)'
    )
  }

  const badPrev = Buffer.from(badVec.Cases[7].Entries[0].EncodedData, 'hex')
  // naming is a bit weird but this is the message we're validating
  const badPreviousMsg = Buffer.from(
    badVec.Cases[7].Entries[1].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badPreviousMsg, badPrev, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: previousBFE is .* but previous message author is .*, expected values to be identical/,
      'catches invalid previous (hash mismatch)'
    )
  }

  const badSignatureMarkerMsg = Buffer.from(
    badVec.Cases[8].Entries[0].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badSignatureMarkerMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: signature, expected a valid BFE signature buffer/,
      'catches invalid signature (incorrect first two bytes)'
    )
  }

  const badSignatureMsg = Buffer.from(
    badVec.Cases[9].Entries[0].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badSignatureMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: signature by must correctly sign the payload/,
      'catches invalid signature (bits flipped)'
    )
  }

  const bseqPrev = Buffer.from(badVec.Cases[10].Entries[0].EncodedData, 'hex')
  const badSequenceMsg = Buffer.from(
    badVec.Cases[10].Entries[1].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badSequenceMsg, bseqPrev, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message: sequence is 3 but prevMsg sequence is 1, expected sequence to be prevMsg.sequence \+ 1/,
      'catches invalid previous (incorrect sequence)'
    )
  }

  const badLengthMsg = Buffer.from(
    badVec.Cases[11].Entries[0].EncodedData,
    'hex'
  )
  try {
    await pify(bendybutt.validate)(badLengthMsg, null, null)
    t.fail('should have thrown error')
  } catch (err) {
    t.match(
      err.message,
      /invalid message size: 8204 bytes, must not be greater than 8192 bytes/,
      'catches invalid message size'
    )
  }

  t.end()
})
