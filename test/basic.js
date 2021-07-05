const tape = require('tape')
const timestamp = require('monotonic-timestamp')
const mfff = require('../')

tape('encode/decode works', function (t) {
  // a message with lots of different cases, please note the
  // signatures are fake (and not relevant to encode/decode test)
  const msg = {
    previous: "%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.bbmsg-v1",
    author: "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1",
    sequence: 2,
    timestamp: 1456154934819,
    content: {
      type: "metafeed/add",
      feedpurpose: "test",
      subfeed: "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1",
      classichash: '%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.sha256',
      bool: true,
      tangles: {
        metafeed: {
          root: null,
          previous: [
            "%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.bbmsg-v1"
          ]
        }
      }
    },
    contentSignature: "K1PgBYX64NUB6bBzcfu4BPEJtjl/Y+PZx7h/y94k6OjqCR9dIHXzjdiM4P7terusbSO464spYjz/LwvP4nqzAg==.sig.ed25519",
    signature: "F/XZ1uOwXNLKSHynxIvV/FUW1Fd9hIqxJw8TgTbMlf39SbVTwdRPdgxZxp9DoaMIj2yEfm14O0L9kcQJCIW2Cg==.sig.ed25519"
  }

  const encoded = mfff.encode(msg)
  t.equal(Buffer.isBuffer(encoded), true, 'buffer')
  const decoded = mfff.decode(encoded)
  t.deepEqual(decoded, msg, 'properly decoded')
  t.end()
})

tape('create', function(t) {
  const mfKeys = {
    "curve": "ed25519",
    "public": "XCesbvDN+9D4momhtlo2BHejPsect6sUzZB2JVm+4v8=.ed25519",
    "private": "GDwNJNpspHpSwT5BRXoHXj0kmFcRRB31DE5MZPeWUStcJ6xu8M370PiaiaG2WjYEd6M+x5y3qxTNkHYlWb7i/w==.ed25519",
    "id": "@XCesbvDN+9D4momhtlo2BHejPsect6sUzZB2JVm+4v8=.bbfeed-v1"
  }

  const mainKeys = {
    "curve": "ed25519",
    "public": "d/zDvFswFbQaYJc03i47C9CgDev+/A8QQSfG5l/SEfw=.ed25519",
    "private": "BSq6H1RYSU9PfFjE40TuvEeHiiAWBr6ec8w6lM93f3Z3/MO8WzAVtBpglzTeLjsL0KAN6/78DxBBJ8bmX9IR/A==.ed25519",
    "id": "@d/zDvFswFbQaYJc03i47C9CgDev+/A8QQSfG5l/SEfw=.ed25519"
  }

  const mainContent = {
    type: "metafeed/add",
    feedpurpose: "main",
    subfeed: mainKeys.id,
    tangles: {
      metafeed: {
        root: null,
        previous: null
      }
    }
  }

  const msg1 = mfff.create(mainContent, mfKeys, mainKeys, null, 1, timestamp())
  const msg1Hash = mfff.hash(msg1)

  t.equal(msg1.previous, null, 'previous correct')
  t.equal(msg1.author, mfKeys.id, 'author correct')
  t.equal(msg1.sequence, 1, 'sequence correct')

  const indexKeys = {
    "curve": "ed25519",
    "public": "0gC5X4ztZ/YDhTJYbv5ZqPhhvI85Fc8uPSI0tE2p6fw=.ed25519",
    "private": "giYugk0/HPu3H/NcW6OSVFNXYC5sN0UwJ7VXASjKVF/SALlfjO1n9gOFMlhu/lmo+GG8jzkVzy49IjS0Tanp/A==.ed25519",
    "id": "@0gC5X4ztZ/YDhTJYbv5ZqPhhvI85Fc8uPSI0tE2p6fw=.bbfeed-v1"
  }

  const indexContent = {
    type: "metafeed/add",
    feedpurpose: "index",
    subfeed: indexKeys.id,
    tangles: {
      metafeed: {
        root: null,
        previous: null
      }
    }
  }

  const msg2 = mfff.create(indexContent, mfKeys, indexKeys, msg1Hash, 2, timestamp())

  t.equal(msg2.previous, msg1Hash)
  t.equal(msg2.sequence, 2, 'sequence correct')

  const msg2network = mfff.decode(mfff.encode(msg2))
  t.deepEqual(msg2, msg2network)

  t.end()
})
