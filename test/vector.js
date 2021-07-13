const tape = require('tape')
const fs = require('fs')
const bb = require('../')
const bfe = require('ssb-bfe')

const vec = JSON.parse(
  fs.readFileSync('test/testvector-metafeed-managment.json', 'utf8')
)

tape('vector', function (t) {
  vec.Entries.forEach((msg, i) => {
    if (msg.HighlevelContent[0].nonce)
      msg.HighlevelContent[0].nonce = Buffer.from(
        msg.HighlevelContent[0].nonce,
        'base64'
      )

    const msgExtracted = {
      author: msg.Author,
      sequence: msg.Sequence,
      previous: msg.Previous,
      timestamp: msg.Timestamp,
      content: msg.HighlevelContent[0],
      contentSignature: bfe.decode(
        Buffer.from(msg.HighlevelContent[1].HexString, 'hex')
      ),
      signature: bfe.decode(Buffer.from(msg.Signature, 'hex')),
    }
    const encoded = bb.encode(msgExtracted)

    const jsonEncodeDecode = JSON.stringify(bb.decode(encoded), null, 2)
    const decode = JSON.stringify(
      bb.decode(Buffer.from(msg.EncodedData, 'hex')),
      null,
      2
    )

    t.deepEqual(jsonEncodeDecode, decode, 'decode work')
    t.deepEqual(encoded.toString('hex'), msg.EncodedData, 'encode work')
  })

  t.end()
})
