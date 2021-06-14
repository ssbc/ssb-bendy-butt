const tape = require('tape')
const fs = require('fs')
const mfff = require('../')
const bfe = require('../ssb-bfe')

const vec = JSON.parse(fs.readFileSync('testvector-metafeed-managment.json', 'utf8'))

tape('vector', function(t) {
  // FIXME: must be included in each entry
  const author = vec.Entries[0].HighlevelContent[0].metafeed

  vec.Entries.forEach(msg => {
    if (msg.HighlevelContent[0].nonce)
      msg.HighlevelContent[0].nonce = Buffer.from(msg.HighlevelContent[0].nonce, 'base64')
    
    const msgExtracted = {
      author,
      sequence: msg.Sequence,
      previous: msg.Previous,
      timestamp: msg.Timestamp,
      content: msg.HighlevelContent[0],
      contentSignature: bfe.decode.signature(Buffer.from(msg.HighlevelContent[1].HexString, 'hex')),
      signature: bfe.decode.signature(Buffer.from(msg.Signature, 'hex')),
    }
    const encoded = mfff.encode(msgExtracted)

    const jsonEncodeDecode = JSON.stringify(mfff.decode(encoded), null, 2)
    const decode = JSON.stringify(mfff.decode(Buffer.from(msg.EncodedData, 'hex')), null, 2)

    t.deepEqual(jsonEncodeDecode, decode, 'decode work')
    t.deepEqual(encoded.toString('hex'), msg.EncodedData, 'encode work')
  })

  t.end()
})
