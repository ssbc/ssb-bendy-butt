const tape = require('tape')
const mfff = require('../')

const msg = {
  "previous": "%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.bbmsg-v1",
  "author": "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1",
  "sequence": 2,
  "timestamp": 1456154934819,
  "content": {
    "type": "metafeed/add",
    "feedformat": "classic",
    "subfeed": "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1",
    "bool": true,
    "tangles": {
      "metafeed": {
        "root": null,
        "previous": [
          "%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.bbmsg-v1"
        ]
      }
    }
  },
  "contentSignature": "K1PgBYX64NUB6bBzcfu4BPEJtjl/Y+PZx7h/y94k6OjqCR9dIHXzjdiM4P7terusbSO464spYjz/LwvP4nqzAg==.sig.bbfeed-v1",
  "signature": "F/XZ1uOwXNLKSHynxIvV/FUW1Fd9hIqxJw8TgTbMlf39SbVTwdRPdgxZxp9DoaMIj2yEfm14O0L9kcQJCIW2Cg==.sig.bbfeed-v1"
}

tape('encode/decode works', function (t) {
  const encoded = mfff.encode(msg)
  t.equal(Buffer.isBuffer(encoded), true, 'buffer')
  const decoded = mfff.decode(encoded)
  t.deepEqual(decoded, msg, 'properly decoded')
  t.end()
})
