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
  // WARNING:
  // gabbygrove-v1 is not currently recognised by `deriveFeedKeyFromSeed`
  // this only works because the gabbygrove-v1 format is accidentally treated as classic
  // (it doesn't match the `=== bendybutt-v1` check and therefore defaults to classic)
  const sf3Keys = deriveFeedKeyFromSeed(
    Buffer.from(sf3Hex, 'hex'),
    'a pre existing feed',
    'gabbygrove-v1'
  )

  vec.Entries.forEach((entry) => {
    const vecMsgVal = entryToMsgValue(entry)
    const encodedVecMsgVal = bb.encode(vecMsgVal)
    const vecEncoded = entry.EncodedData

    t.deepEqual(encodedVecMsgVal.toString('hex'), vecEncoded, 'encode works')

    const decodedEncodedVecMsgVal = bb.decode(encodedVecMsgVal)
    const decoded = bb.decode(Buffer.from(entry.EncodedData, 'hex'))

    t.deepEqual(decodedEncodedVecMsgVal, decoded, 'decode works')

    // TODO: this needs to be cleaned up badly...
    let sfKeys = vecMsgVal.content.subfeed === sf1Keys.id ? sf1Keys : null
    if (sfKeys == null) {
      sfKeys =
        vecMsgVal.content.subfeed ===
        'ssb:feed/gabbygrove-v1/FY5OG311W4j_KPh8H9B2MZt4WSziy_p-ABkKERJdujQ='
          ? sf2Keys
          : sf3Keys
    }

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
