// SPDX-FileCopyrightText: 2021 Anders Rune Jensen
//
// SPDX-License-Identifier: Unlicense

const tape = require('tape')
const fs = require('fs')
const bfe = require('ssb-bfe')
const { deriveFeedKeyFromSeed } = require('ssb-meta-feeds/keys')
const bendybutt = require('../format')

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

tape('vector', function (t) {
  const getHex = (obj) => obj.HexString
  // TODO: this needs to be cleaned up badly...
  const [mfHex, sf1Hex, sf2Hex, sf3Hex] =
    vec.Metadata.filter(getHex).map(getHex)
  const mfKeys = deriveFeedKeyFromSeed(
    Buffer.from(mfHex, 'hex'),
    'testfeed',
    'bendybutt-v1'
  )
  const sf1Keys = deriveFeedKeyFromSeed(
    Buffer.from(mfHex, 'hex'),
    Buffer.from(sf1Hex, 'hex').toString('base64')
  )
  const sf2Keys = deriveFeedKeyFromSeed(
    Buffer.from(mfHex, 'hex'),
    Buffer.from(sf2Hex, 'hex').toString('base64')
  )
  const sf3Keys = deriveFeedKeyFromSeed(
    Buffer.from(sf3Hex, 'hex'),
    'a pre existing feed',
    'gabbygrove-v1'
  )

  vec.Entries.forEach((entry) => {
    const vecMsgVal = entryToMsgValue(entry)
    const vecNativeMsg = bendybutt.toNativeMsg(vecMsgVal)
    const vecEncoded = entry.EncodedData

    t.deepEqual(vecNativeMsg.toString('hex'), vecEncoded, 'toNativeMsg works')

    const decodedEncodedVecMsgVal = bendybutt.fromNativeMsg(vecNativeMsg)
    const decoded = bendybutt.fromNativeMsg(
      Buffer.from(entry.EncodedData, 'hex')
    )

    t.deepEqual(decodedEncodedVecMsgVal, decoded, 'fromNativeMsg works')

    // TODO: this needs to be cleaned up badly...
    let sfKeys = vecMsgVal.content.subfeed === sf1Keys.id ? sf1Keys : null
    if (sfKeys == null) {
      sfKeys =
        vecMsgVal.content.subfeed ===
        'ssb:feed/gabbygrove-v1/FY5OG311W4j_KPh8H9B2MZt4WSziy_p-ABkKERJdujQ='
          ? sf2Keys
          : sf3Keys
    }

    const bbmsg = bendybutt.newNativeMsg({
      content: vecMsgVal.content,
      keys: mfKeys,
      contentKeys: sfKeys,
      previous: {
        key: vecMsgVal.previous,
        value: { sequence: vecMsgVal.sequence - 1 },
      },
      timestamp: vecMsgVal.timestamp,
      hmacKey: null,
    })
    const rebuiltMsgVal = bendybutt.fromNativeMsg(bbmsg)

    t.deepEquals(vecMsgVal, rebuiltMsgVal, 'newNativeMsg works')
  })

  t.end()
})
