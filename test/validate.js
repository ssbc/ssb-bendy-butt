const tape = require('tape')
const fs = require('fs')
const bencode = require('bencode')
const bfe = require('ssb-bfe')
const crypto = require('crypto')
const bb = require('../')

const vec = JSON.parse(
  fs.readFileSync('test/testvector-metafeed-managment.json', 'utf8')
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

tape('validation works', function (t) {
  const msg1 = entryToMsgValue(vec.Entries[0])
  const msg2 = entryToMsgValue(vec.Entries[1])
  const msg3 = entryToMsgValue(vec.Entries[2])

  const bbmsg1 = bb.encode(msg1)
  const bbmsg2 = bb.encode(msg2)
  const bbmsg3 = bb.encode(msg3)

  const msg1ValidationResult = bb.decodeAndValidateSingle(bbmsg1, null, null)
  t.ok(msg1ValidationResult, 'validates 1st message (seq 1) without previous')

  const msg2ValidationResult = bb.decodeAndValidateSingle(
    bbmsg2,
    msg1ValidationResult,
    null
  )
  t.ok(msg2ValidationResult, 'validates 2nd message with previous')

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

  const incorrectPreviousValidationResult = bb.decodeAndValidateSingle(
    bbmsg3,
    msg1,
    null
  )
  t.deepEqual(
    incorrectPreviousValidationResult.message,
    'invalid message: previous is "%7DXLzzMf8VnymjSd7GVkItMKWGxtokToAFDm3YnwDmA=.bbmsg-v1" but the computed hash of the previous message is "%QnDB5I/djZL75M3T6EU4MiCS5x7++pwXuAJo6lEH6W4=.bbmsg-v1", expected values to be identical',
    'catches incorrect previous msg hash'
  )

  const msg3BadAuthor = msg3
  msg3BadAuthor.author =
    '@c77R2e7lj8h7NFqGhOu6lCGy8gLxWV+J4ORd1X7rP3c=.bbfeed-v1'
  const bbmsg3BadAuthor = bb.encode(msg3BadAuthor)
  const incorrectAuthorValidationResult = bb.decodeAndValidateSingle(
    bbmsg3BadAuthor,
    msg2,
    null
  )
  t.deepEqual(
    incorrectAuthorValidationResult.message,
    'invalid message: author is "@c77R2e7lj8h7NFqGhOu6lCGy8gLxWV+J4ORd1X7rP3c=.bbfeed-v1" but previous message author is "@b99R2e7lj8h7NFqGhOu6lCGy8gLxWV+J4ORd1X7rP3c=.bbfeed-v1", expected values to be identical',
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
    'invalid hmac key: "not a valid hmac key", expected string to be base64 encoded',
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

  t.end()
})
