const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const curve = require('ssb-keys/sodium')
const u = require('ssb-keys/util')
const bfe = require('ssb-bfe')

module.exports.decodeBox2 = function(box2) {
  const decoded = bencode.decode(box2)
  return bfe.decode(decoded)
}

// assumes msg has already been validated
// returns a classic compatible json object
module.exports.decode = function(bmsg) {
  const [payload, signature] = bencode.decode(bmsg)
  const [author, sequence, previous, timestamp, contentSection] = payload

  const result = {
    previous: bfe.decode(previous),
    author: bfe.decode(author),
    sequence: bfe.decode(sequence),
    timestamp: bfe.decode(timestamp),
    signature: bfe.decode(signature)
  }

  if (Array.isArray(contentSection)) {
    const [content, contentSignature] = contentSection
    Object.assign(result, {
      content: bfe.decode(content),
      contentSignature: bfe.decode(contentSignature),
    })
  }
  // box2
  else {
    const content = contentSection
    Object.assign(result, {
      content: bfe.decode(content)
    })
  }

  return result
}

// input: json encoded msg from db
module.exports.encode = function(msg) {
  const contentSection =
    typeof msg.content === 'string' && msg.content.endsWith('.box2')
      ? bfe.encodeBendyButt(msg.content)
      : [
          bfe.encodeBendyButt(msg.content),
          bfe.encodeBendyButt(msg.contentSignature)
        ]

  return bencode.encode(
    [
      [
        bfe.encodeBendyButt(msg.author),
        bfe.encodeBendyButt(msg.sequence),
        bfe.encodeBendyButt(msg.previous),
        bfe.encodeBendyButt(msg.timestamp),
        contentSection
      ],
      bfe.encodeBendyButt(msg.signature)
    ]
  )
}

// returns a classic compatible json object
module.exports.create = function(content, mfKeys, sfKeys, previous, sequence, timestamp, boxer) {
  const convertedContent = bfe.encodeBendyButt(content)
  const contentSignature = Buffer.concat([
    Buffer.from([4, 0]), // FIXME: this module should not know about this detail
    curve.sign(u.toBuffer(sfKeys.private),
               bencode.encode(convertedContent))
  ])

  let contentAndSignature = [
    convertedContent,
    contentSignature
  ]

  if (content.recps)
    contentAndSignature = boxer(
      bfe.encodeBendyButt(mfKeys.id),
      bencode.encode(contentAndSignature),
      bfe.encodeBendyButt(previous),
      content.recps
    )

  const payload = [
    mfKeys.public,
    sequence + 1,
    previous,
    timestamp,
    contentAndSignature
  ]

  const convertedPayload = bfe.encodeBendyButt(payload)
  const payloadSignature = Buffer.concat([
    Buffer.from([4, 0]), // FIXME: this module should not know about this detail
    curve.sign(u.toBuffer(mfKeys.private),
               bencode.encode(convertedPayload))
  ])

  const result = {
    previous,
    author: mfKeys.id,
    sequence,
    timestamp,
    signature: bfe.decode(payloadSignature)
  }

  if (content.recps) {
    Object.assign(result, {
      content: contentAndSignature
    })
  } else {
    Object.assign(result, {
      content,
      contentSignature: bfe.decode(contentSignature)
    })
  }

  return result
}

// msg must be a classic compatible msg
module.exports.hash = function(msg) {
  return '%' + ssbKeys.hash(module.exports.encode(msg)).replace(".sha256", '.bbmsg-v1')
}

// FIXME: might split this out and add validateBatch
function validateSingle(bmsg, previous) {

}
