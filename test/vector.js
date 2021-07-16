const tape = require('tape')
const fs = require('fs')
const bfe = require('ssb-bfe')
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
  const getKeys = (obj) => obj.Keys
  const [mfKeys, sf1Keys, sf2Keys] = vec.Metadata.filter(getKeys).map(getKeys)

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

    // FIXME: pending on test vectors being updated with inputPrefix=bendybutt
    // t.equals(
    //   rebuiltMsgVal.contentSignature,
    //   vecMsgVal.contentSignature,
    //   'encodeNew works'
    // )
  })

  t.end()
})
