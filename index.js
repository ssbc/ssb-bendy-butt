const bencode = require('bencode')
const curve = require('ssb-keys/sodium')
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

// FIXME: might split this out and add validateBatch
function validateSingle(bmsg, previous) {
  
}
