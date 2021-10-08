// SPDX-FileCopyrightText: 2021 Anders Rune Jensen
//
// SPDX-License-Identifier: Unlicense

const tape = require('tape')
const fs = require('fs')
const bencode = require('bencode')
const bfe = require('ssb-bfe')
const crypto = require('crypto')
const bb = require('../')

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

tape('validation works (validateSingle)', function (t) {
  const msg1 = entryToMsgValue(vec.Entries[0])
  const msg2 = entryToMsgValue(vec.Entries[1])
  const msg3 = entryToMsgValue(vec.Entries[2])

  t.pass('[ basic tests ]')

  const msg1ValidationResult = bb.validateSingle(msg1, null, null)
  t.deepEqual(
    msg1ValidationResult,
    undefined,
    'validates 1st message (seq 1) without previous'
  )

  const msg2ValidationResult = bb.validateSingle(msg2, msg1, null)
  t.deepEqual(
    msg2ValidationResult,
    undefined,
    'validates 2nd message with previous'
  )

  const noPreviousValidationResult = bb.validateSingle(msg3, null, null)
  t.deepEqual(
    noPreviousValidationResult.name,
    'Error',
    'returns error object when missing previous msg'
  )
  t.deepEqual(
    noPreviousValidationResult.message,
    'invalid previousMsg: value must not be undefined if sequence > 1',
    'catches missing previous msg'
  )

  // temporarily change sequence to align with msg3
  msg1.sequence = 2
  const incorrectPreviousValidationResult = bb.validateSingle(msg3, msg1, null)
  t.deepEqual(
    incorrectPreviousValidationResult.message,
    'invalid message: previous is "ssb:message/bendybutt-v1/igh9DQn0vIYEbF9VwLVrBaRryprQI_8kO_Yj-TIzAc0=" but the computed hash of the previous message is "ssb:message/bendybutt-v1/M7F67N_Iz9J2MaBaccd_zktGlLxySNlaoZRMY4Rxes0=", expected values to be identical',
    'catches incorrect previous msg hash'
  )
  // revert sequence change to avoid breaking downstream tests
  msg1.sequence = 1

  const incorrectAuthorMsg = msg3
  incorrectAuthorMsg.author =
    'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0='
  const incorrectAuthorValidationResult = bb.validateSingle(
    incorrectAuthorMsg,
    msg2,
    null
  )
  t.deepEqual(
    incorrectAuthorValidationResult.message,
    'invalid message: author is "ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=" but previous message author is "ssb:feed/bendybutt-v1/b99R2e7lj8h7NFqGhOu6lCGy8gLxWV-J4ORd1X7rP3c=", expected values to be identical',
    'catches incorrect previous msg author'
  )

  const hmacKey = Buffer.from('not a valid hmac key')
  const invalidHmacValidationResult = bb.validateSingle(msg2, msg1, hmacKey)
  t.deepEqual(
    invalidHmacValidationResult.message,
    'invalid hmac key: "not a valid hmac key" with length 20, expected 32 bytes',
    'catches invalid hmac (not base64 encoded)'
  )

  const tamperedSignatureMsg = msg1
  // change the first character of the signature to invalidate it ('G' -> 'Z')
  tamperedSignatureMsg.signature =
    'ZkuHYMetsUCVXzM70u7grRBrVYjdo35EGl/Gr8wq4yis+5WND4WACanaDQpVGn4H0lmqmb87gDT9UdSF9STyDg==.sig.ed25519'
  const tamperedSignatureValidationResult = bb.validateSingle(
    tamperedSignatureMsg,
    null,
    null
  )
  t.deepEqual(
    tamperedSignatureValidationResult.message,
    'invalid message: signature must correctly sign the payload',
    'catches invalid signature (altered first character)'
  )

  t.end()
})

tape('validation works (decodeAndValidateSingle)', function (t) {
  const msg1 = entryToMsgValue(vec.Entries[0])
  const msg2 = entryToMsgValue(vec.Entries[1])
  const msg3 = entryToMsgValue(vec.Entries[2])

  const bbmsg1 = Buffer.from(vec.Entries[0].EncodedData, 'hex')
  const bbmsg2 = Buffer.from(vec.Entries[1].EncodedData, 'hex')
  const bbmsg3 = Buffer.from(vec.Entries[2].EncodedData, 'hex')

  t.pass('[ basic tests ]')

  const msg1ValidationResult = bb.decodeAndValidateSingle(bbmsg1, null, null)
  t.deepEqual(
    msg1ValidationResult,
    msg1,
    'validates 1st message (seq 1) without previous'
  )

  const msg2ValidationResult = bb.decodeAndValidateSingle(
    bbmsg2,
    msg1ValidationResult,
    null
  )
  t.deepEqual(msg2ValidationResult, msg2, 'validates 2nd message with previous')

  const noPreviousValidationResult = bb.decodeAndValidateSingle(
    bbmsg2,
    null,
    null
  )
  t.deepEqual(
    noPreviousValidationResult.name,
    'Error',
    'returns error object when missing previous msg'
  )
  t.deepEqual(
    noPreviousValidationResult.message,
    'invalid previousMsg: value must not be undefined if sequence > 1',
    'catches missing previous msg'
  )

  // temporarily change sequence to align with msg3
  msg1.sequence = 2
  const incorrectPreviousValidationResult = bb.decodeAndValidateSingle(
    bbmsg3,
    msg1,
    null
  )
  t.deepEqual(
    incorrectPreviousValidationResult.message,
    'invalid message: previous is "ssb:message/bendybutt-v1/igh9DQn0vIYEbF9VwLVrBaRryprQI_8kO_Yj-TIzAc0=" but the computed hash of the previous message is "ssb:message/bendybutt-v1/M7F67N_Iz9J2MaBaccd_zktGlLxySNlaoZRMY4Rxes0=", expected values to be identical',
    'catches incorrect previous msg hash'
  )
  // revert sequence change to avoid breaking downstream tests
  msg1.sequence = 1

  const msg3BadAuthor = msg3
  msg3BadAuthor.author =
    'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0='
  const bbmsg3BadAuthor = bb.encode(msg3BadAuthor)
  const incorrectAuthorValidationResult = bb.decodeAndValidateSingle(
    bbmsg3BadAuthor,
    msg2,
    null
  )
  t.deepEqual(
    incorrectAuthorValidationResult.message,
    'invalid message: author is "ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=" but previous message author is "ssb:feed/bendybutt-v1/b99R2e7lj8h7NFqGhOu6lCGy8gLxWV-J4ORd1X7rP3c=", expected values to be identical',
    'catches incorrect previous msg author'
  )

  const bigMsg = Buffer.alloc(8888)
  const tooBigValidationResult = bb.decodeAndValidateSingle(bigMsg, null, null)
  t.deepEqual(
    tooBigValidationResult.message,
    'invalid message size: 8888 bytes, must not be greater than 8192 bytes',
    'catches invalid message size (too big)'
  )

  // this is a contrived example, since `bb.encode()` always returns a list of 2 items.
  // we're running the test to ensure a custom-crafted bencoded msg can't pass through
  // unless it's an array of 2 items (after decoding).
  const list = [1, 2, 3]
  const longMsg = bencode.encode(list)
  const incorrectShapeValidationResult = bb.decodeAndValidateSingle(
    longMsg,
    null,
    null
  )
  t.deepEqual(
    incorrectShapeValidationResult.message,
    'invalid message: object with length 3, expected a list of payload and signature',
    'catches invalid message length (too many items in list)'
  )

  const shortPayload = bencode.decode(bbmsg3)
  // remove the last item from the payload list (`contentSection`)
  shortPayload[0].pop()
  const shortPayloadMsg = bencode.encode(shortPayload)
  const shortPayloadValidationResult = bb.decodeAndValidateSingle(
    shortPayloadMsg,
    null,
    null
  )
  t.deepEqual(
    shortPayloadValidationResult.message,
    'invalid message payload: object with length 4, expected a list of author, sequence, previous, timestamp and contentSection',
    'catches invalid payload length (too few items in list)'
  )

  const hmacKey = Buffer.from('not a valid hmac key')
  const invalidHmacValidationResult = bb.decodeAndValidateSingle(
    bbmsg2,
    msg1,
    hmacKey
  )
  t.deepEqual(
    invalidHmacValidationResult.message,
    'invalid hmac key: "not a valid hmac key" with length 20, expected 32 bytes',
    'catches invalid hmac (not base64 encoded)'
  )

  const msg1BFE = bencode.decode(bbmsg1)
  // set invalid type-format value for msg.payload.author
  msg1BFE[0][0] = Buffer.from([7, 7])
  const invalidAuthorTypeFormatMsg = bencode.encode(msg1BFE)
  const invalidAuthorTypeFormatValidationResult = bb.decodeAndValidateSingle(
    invalidAuthorTypeFormatMsg,
    null,
    null
  )
  t.deepEqual(
    invalidAuthorTypeFormatValidationResult.message,
    'invalid message: author type-format "0x0707" is incorrect, expected 0x0003',
    'catches invalid type-format for msg author'
  )

  // set valid type-format value for msg.payload.author
  msg1BFE[0][0] = Buffer.from([0, 3])
  // set invalid type-format value for msg.payload.previous
  msg1BFE[0][2] = Buffer.from([8, 8])
  const invalidPreviousTypeFormatMsg = bencode.encode(msg1BFE)
  const invalidPreviousTypeFormatValidationResult = bb.decodeAndValidateSingle(
    invalidPreviousTypeFormatMsg,
    null,
    null
  )
  t.deepEqual(
    invalidPreviousTypeFormatValidationResult.message,
    'invalid message: previous type-format "0x0808" is incorrect, expected 0x0602 (nil type-format) because sequence is 1',
    'catches invalid type-format for previous (seq 1)'
  )

  const msg2BFE = bencode.decode(bbmsg2)
  // set invalid type-format value for msg.payload.author
  msg2BFE[0][2] = Buffer.from([9, 9])
  const invalidAuthorTypeFormatMsg2 = bencode.encode(msg2BFE)
  const invalidAuthorTypeFormatValidationResult2 = bb.decodeAndValidateSingle(
    invalidAuthorTypeFormatMsg2,
    msg1,
    null
  )
  t.deepEqual(
    invalidAuthorTypeFormatValidationResult2.message,
    'invalid message: previous type-format "0x0909" is incorrect, expected 0x0104',
    'catches invalid type-format for previous (seq > 1)'
  )

  /* --------------------------------------------------- */
  /* tests using `testvector-metafeed-bad-messages.json` */
  /* --------------------------------------------------- */

  t.pass('[ vector tests ]')

  const badAuthorTypeMsg = Buffer.from(
    badVec.Cases[0].Entries[0].EncodedData,
    'hex'
  )
  const badAuthorTypeResult = bb.decodeAndValidateSingle(
    badAuthorTypeMsg,
    null,
    null
  )
  t.deepEqual(
    badAuthorTypeResult.message,
    'invalid message: author type-format "0xff03" is incorrect, expected 0x0003',
    'catches invalid author (TFD type)'
  )

  const badAuthorFormatMsg = Buffer.from(
    badVec.Cases[1].Entries[0].EncodedData,
    'hex'
  )
  const badAuthorFormatResult = bb.decodeAndValidateSingle(
    badAuthorFormatMsg,
    null,
    null
  )
  t.deepEqual(
    badAuthorFormatResult.message,
    'invalid message: author type-format "0x00ff" is incorrect, expected 0x0003',
    'catches invalid author (TFD format)'
  )

  const badAuthorLengthMsg = Buffer.from(
    badVec.Cases[2].Entries[0].EncodedData,
    'hex'
  )
  const badAuthorLengthResult = bb.decodeAndValidateSingle(
    badAuthorLengthMsg,
    null,
    null
  )
  t.deepEqual(
    badAuthorLengthResult.message,
    'invalid message: author type-format-data length of 50 bytes is incorrect, expected 34 bytes',
    'catches invalid author (TFD length)'
  )

  const bptPrev = Buffer.from(badVec.Cases[3].Entries[0].EncodedData, 'hex')
  const bptPrevMsg = bb.decodeAndValidateSingle(bptPrev, null, null)
  const badPreviousTypeMsg = Buffer.from(
    badVec.Cases[3].Entries[1].EncodedData,
    'hex'
  )
  const badPreviousTypeResult = bb.decodeAndValidateSingle(
    badPreviousTypeMsg,
    bptPrevMsg,
    null
  )
  t.deepEqual(
    badPreviousTypeResult.message,
    'invalid message: previous type-format "0xff04" is incorrect, expected 0x0104',
    'catches invalid previous (TFD type)'
  )

  const bpfPrev = Buffer.from(badVec.Cases[4].Entries[0].EncodedData, 'hex')
  const bpfPrevMsg = bb.decodeAndValidateSingle(bpfPrev, null, null)
  const badPreviousFormatMsg = Buffer.from(
    badVec.Cases[4].Entries[1].EncodedData,
    'hex'
  )
  const badPreviousFormatResult = bb.decodeAndValidateSingle(
    badPreviousFormatMsg,
    bpfPrevMsg,
    null
  )
  t.deepEqual(
    badPreviousFormatResult.message,
    'invalid message: previous type-format "0x01ff" is incorrect, expected 0x0104',
    'catches invalid previous (TFD format)'
  )

  const bplPrev = Buffer.from(badVec.Cases[5].Entries[0].EncodedData, 'hex')
  const bplPrevMsg = bb.decodeAndValidateSingle(bplPrev, null, null)
  const badPreviousLengthMsg = Buffer.from(
    badVec.Cases[5].Entries[1].EncodedData,
    'hex'
  )
  const badPreviousLengthResult = bb.decodeAndValidateSingle(
    badPreviousLengthMsg,
    bplPrevMsg,
    null
  )
  t.deepEqual(
    badPreviousLengthResult.message,
    'invalid message: previous is "ssb:message/bendybutt-v1/6Hcxz4DdtlFzBReDrFolk2bJ9dXHmiW1plFkAPfO3o3_____________________" but the computed hash of the previous message is "ssb:message/bendybutt-v1/6Hcxz4DdtlFzBReDrFolk2bJ9dXHmiW1plFkAPfO3o0=", expected values to be identical',
    'catches invalid previous (hash mismatch; length)'
  )

  const badPreviousTypeFormatMsg = Buffer.from(
    badVec.Cases[6].Entries[0].EncodedData,
    'hex'
  )
  const badPreviousTypeFormatResult = bb.decodeAndValidateSingle(
    badPreviousTypeFormatMsg,
    null,
    null
  )
  t.deepEqual(
    badPreviousTypeFormatResult.message,
    'invalid message: previous type-format "0x3132" is incorrect, expected 0x0602 (nil type-format) because sequence is 1',
    'catches invalid previous (should be null)'
  )

  const badPrev = Buffer.from(badVec.Cases[7].Entries[0].EncodedData, 'hex')
  const badPrevMsg = bb.decodeAndValidateSingle(badPrev, null, null)
  // naming is a bit weird but this is the message we're validating
  const badPreviousMsg = Buffer.from(
    badVec.Cases[7].Entries[1].EncodedData,
    'hex'
  )
  const badPreviousResult = bb.decodeAndValidateSingle(
    badPreviousMsg,
    badPrevMsg,
    null
  )
  t.deepEqual(
    badPreviousResult.message,
    'invalid message: previous is "ssb:message/bendybutt-v1/__________________________________________8=" but the computed hash of the previous message is "ssb:message/bendybutt-v1/QsJOQDJxn9EF3LjvMr5pdupEbAOwFgJSB_iWGh0u8-k=", expected values to be identical',
    'catches invalid previous (hash mismatch)'
  )

  const badSignatureMarkerMsg = Buffer.from(
    badVec.Cases[8].Entries[0].EncodedData,
    'hex'
  )
  // this should make ssb-bfe explode: 'Cannot decode buffer acab32...'
  t.throws(
    () => {
      bb.decodeAndValidateSingle(badSignatureMarkerMsg, null, null)
    },
    {
      message:
        'Cannot decode buffer acab32db9170193d7c5925380497fea41622cdaa9c19a94fecb053f3447549acf4b65a8687532c11e15108d20ce1f8878c6d33a3feb533f1515b1d3a2b4e9242080c',
    },
    'catches invalid signature (incorrect first two bytes)'
  )

  const badSignatureMsg = Buffer.from(
    badVec.Cases[9].Entries[0].EncodedData,
    'hex'
  )
  const badSignatureResult = bb.decodeAndValidateSingle(
    badSignatureMsg,
    null,
    null
  )
  t.deepEqual(
    badSignatureResult.message,
    'invalid message: signature must correctly sign the payload',
    'catches invalid signature (bits flipped)'
  )
  const bseqPrev = Buffer.from(badVec.Cases[10].Entries[0].EncodedData, 'hex')
  const bseqPrevMsg = bb.decodeAndValidateSingle(bseqPrev, null, null)
  const badSequenceMsg = Buffer.from(
    badVec.Cases[10].Entries[1].EncodedData,
    'hex'
  )
  const badSequenceResult = bb.decodeAndValidateSingle(
    badSequenceMsg,
    bseqPrevMsg,
    null
  )
  t.deepEqual(
    badSequenceResult.message,
    'invalid message: sequence is 3 but prevMsg sequence is 1, expected sequence to be prevMsg.sequence + 1',
    'catches invalid previous (incorrect sequence)'
  )

  const badLengthMsg = Buffer.from(
    badVec.Cases[11].Entries[0].EncodedData,
    'hex'
  )
  const badLengthResult = bb.decodeAndValidateSingle(badLengthMsg, null, null)
  t.deepEqual(
    badLengthResult.message,
    'invalid message size: 8204 bytes, must not be greater than 8192 bytes',
    'catches invalid message size'
  )

  t.end()
})
