const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const bfe = require('ssb-bfe')

function decodeBox2(box2) {
  const decoded = bencode.decode(box2)
  return bfe.decode(decoded)
}

// assumes msg has already been validated
// returns a classic compatible json object
function decode(bmsg) {
  const [payload, signature] = bencode.decode(bmsg)
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

// input: json encoded msg from db
function encode(msg) {
  const contentSection =
    typeof msg.content === 'string' && msg.content.endsWith('.box2')
      ? bfe.encodeBendyButt(msg.content)
      : [
          bfe.encodeBendyButt(msg.content),
          bfe.encodeBendyButt(msg.contentSignature),
        ]

  return bencode.encode([
    [
      bfe.encodeBendyButt(msg.author),
      bfe.encodeBendyButt(msg.sequence),
      bfe.encodeBendyButt(msg.previous),
      bfe.encodeBendyButt(msg.timestamp),
      contentSection,
    ],
    bfe.encodeBendyButt(msg.signature),
  ])
}

// returns a classic compatible json object
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

  const result = {
    previous,
    author: mfKeys.id,
    sequence,
    timestamp,
    signature: bfe.decode(payloadSignatureBFE),
  }

  if (content.recps) {
    Object.assign(result, {
      content: contentSection,
    })
  } else {
    Object.assign(result, {
      content,
      contentSignature: bfe.decode(contentSignatureBFE),
    })
  }

  return result
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
