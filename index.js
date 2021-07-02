const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const curve = require('ssb-keys/sodium')
const u = require('ssb-keys/util')
const bfe = require('./ssb-bfe')

// assumes msg has already been validated
// returns a classic compatible json object
module.exports.decode = function(bmsg) {
  const decoded = bencode.decode(bmsg)

  return {
    previous: bfe.decode.message(decoded[0][2]),
    author: bfe.decode.feed(decoded[0][0]),
    sequence: decoded[0][1],
    timestamp: decoded[0][3],
    content: bfe.decode.convert(decoded[0][4][0]), // FIXME: handle box2
    contentSignature: bfe.decode.signature(decoded[0][4][1]),
    signature: bfe.decode.signature(decoded[1])
  }
}

// input: json encoded msg from db
module.exports.encode = function(msg) {
  // FIXME: maybe box2
  return bencode.encode(
    [
      [
        bfe.encode.feed(msg.author),
        msg.sequence,
        bfe.encode.message(msg.previous),
        msg.timestamp,
        [
          bfe.encode.convert(msg.content),
          bfe.encode.signature(msg.contentSignature)
        ]
      ],
      bfe.encode.signature(msg.signature)
    ]
  )
}

// returns a classic compatible json object
module.exports.create = function(content, mfKeys, sfKeys, previous, sequence, timestamp) {
  const convertedContent = bfe.encode.convert(content)
  const contentSignature = Buffer.concat([
    Buffer.from([4]),
    Buffer.from([0]),
    curve.sign(u.toBuffer(sfKeys.private),
               bencode.encode(convertedContent))
  ])

  const payload = [
    mfKeys.public,
    sequence + 1,
    previous,
    timestamp,
    [
      convertedContent,
      contentSignature
    ]
  ]

  const convertedPayload = bfe.encode.convert(payload)
  const payloadSignature = Buffer.concat([
    Buffer.from([4]),
    Buffer.from([0]),
    curve.sign(u.toBuffer(mfKeys.private),
               bencode.encode(convertedPayload))
  ])

  return {
    previous,
    author: mfKeys.id,
    sequence,
    timestamp,
    content,
    contentSignature: bfe.decode.signature(contentSignature),
    signature: bfe.decode.signature(payloadSignature)
  }
}

// msg must be a classic compatible msg
module.exports.hash = function(msg) {
  return '%' + ssbKeys.hash(module.exports.encode(msg)).replace(".sha256", '.bbmsg-v1')
}

// FIXME: might split this out and add validateBatch
function validateSingle(bmsg, previous) {
  
}
