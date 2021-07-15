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
  vec.Entries.forEach((entry) => {
    const msgExtracted = entryToMsgValue(entry)
    const encoded = bb.encode(msgExtracted)

    const jsonEncodeDecode = bb.decode(encoded)
    const decode = bb.decode(Buffer.from(entry.EncodedData, 'hex'))

    t.deepEqual(jsonEncodeDecode, decode, 'decode work')
    t.deepEqual(encoded.toString('hex'), entry.EncodedData, 'encode work')
  })

  t.end()
})
