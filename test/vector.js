const tape = require('tape')
const fs = require('fs')
const bfe = require('ssb-bfe')
const { deriveFeedKeyFromSeed } = require('ssb-meta-feeds/keys')
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

tape('vector', function (t) {
  const getHex = (obj) => obj.HexString
  const [mfHex, sf1Hex, sf2Hex] = vec.Metadata.filter(getHex).map(getHex)
  const mfKeys = deriveFeedKeyFromSeed(
    Buffer.from(mfHex, 'hex'),
    'testfeed',
    'bendy butt'
  )
  const sf1Keys = deriveFeedKeyFromSeed(
    Buffer.from(mfHex, 'hex'),
    Buffer.from(sf1Hex, 'hex').toString('base64')
  )
  const sf2Keys = deriveFeedKeyFromSeed(
    Buffer.from(mfHex, 'hex'),
    Buffer.from(sf2Hex, 'hex').toString('base64')
  )

  vec.Entries.forEach((entry) => {
    const vecMsgVal = entryToMsgValue(entry)
    const encodedVecMsgVal = bb.encode(vecMsgVal)
    const vecEncoded = entry.EncodedData

    t.deepEqual(encodedVecMsgVal.toString('hex'), vecEncoded, 'encode works')

    const decodedEncodedVecMsgVal = bb.decode(encodedVecMsgVal)
    const decoded = bb.decode(Buffer.from(entry.EncodedData, 'hex'))

    t.deepEqual(decodedEncodedVecMsgVal, decoded, 'decode works')

    const sfKeys = vecMsgVal.content.subfeed === sf1Keys.id ? sf1Keys : sf2Keys
    const bbmsg = bb.encodeNew(
      vecMsgVal.content,
      sfKeys,
      mfKeys,
      vecMsgVal.sequence,
      vecMsgVal.previous,
      vecMsgVal.timestamp
    )
    const rebuiltMsgVal = bb.decode(bbmsg)

    t.deepEquals(vecMsgVal, rebuiltMsgVal, 'encodeNew works')
  })

  t.end()
})
