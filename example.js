// SPDX-FileCopyrightText: 2021 Anders Rune Jensen
//
// SPDX-License-Identifier: Unlicense

const fs = require('fs')
const path = require('path')
const ssbKeys = require('ssb-keys')
const bencode = require('bencode')
const mfff = require('./')
const bfe = require('./ssb-bfe')

const msg = {
  previous: '%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.bbmsg-v1',
  author: '@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1',
  sequence: 2,
  timestamp: 1456154934819,
  content: {
    type: 'metafeed/add',
    feedformat: 'classic',
    subfeed: '@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1', // bad example
    bool: true,
    tangles: {
      metafeed: {
        root: null,
        previous: ['%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.bbmsg-v1'],
      },
    },
  },
}

const keys = ssbKeys.loadOrCreateSync(path.join('/home/arj/.ssb', 'secret'))
var curve = require('ssb-keys/sodium')
toBuffer = function (buf) {
  if (buf == null) return buf
  if (Buffer.isBuffer(buf)) return buf
  var i = buf.indexOf('.')
  var start = 0
  return Buffer.from(buf.substring(start, ~i ? i : buf.length), 'base64')
}

const encodedContent = bfe.encode.convert(msg.content)
msg.contentSignature = bfe.decode.signature(
  Buffer.concat([
    Buffer.from([4]),
    Buffer.from([0]),
    curve.sign(toBuffer(keys.private), bencode.encode(encodedContent)),
  ])
)

const payload = [
  bfe.encode.feed(msg.author),
  msg.sequence,
  bfe.encode.message(msg.previous),
  msg.timestamp,
  [bfe.encode.convert(msg.content), bfe.encode.signature(msg.contentSignature)],
]
msg.signature = bfe.decode.signature(
  Buffer.concat([
    Buffer.from([4]),
    Buffer.from([0]),
    curve.sign(toBuffer(keys.private), bencode.encode(payload)),
  ])
)

console.log(JSON.stringify(msg, null, 2))

//const data = fs.readFileSync('m0.bencode')
//console.log(mfff.decode(data))
