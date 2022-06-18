// SPDX-FileCopyrightText: 2021 Anders Rune Jensen
//
// SPDX-License-Identifier: Unlicense

const tape = require('tape')
const bendybutt = require('../format')

tape('fromNativeMsg/toNativeMsg works', function (t) {
  // a message with lots of different cases, please note the
  // signatures are fake (and not relevant to encode/decode test)
  const msg = {
    previous:
      'ssb:message/bendybutt-v1/H3MlLmVPVgHU6rBSzautUBZibDttkI-cU4lAFUIM8Ag=',
    author:
      'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=',
    sequence: 2,
    timestamp: 1456154934819,
    content: {
      type: 'metafeed/add/existing',
      feedpurpose: 'test',
      subfeed:
        'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=',
      classichash: '%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.sha256',
      bool: true,
      tangles: {
        metafeed: {
          root: null,
          previous: [
            'ssb:message/bendybutt-v1/H3MlLmVPVgHU6rBSzautUBZibDttkI-cU4lAFUIM8Ag=',
          ],
        },
      },
    },
    contentSignature:
      'K1PgBYX64NUB6bBzcfu4BPEJtjl/Y+PZx7h/y94k6OjqCR9dIHXzjdiM4P7terusbSO464spYjz/LwvP4nqzAg==.sig.ed25519',
    signature:
      'F/XZ1uOwXNLKSHynxIvV/FUW1Fd9hIqxJw8TgTbMlf39SbVTwdRPdgxZxp9DoaMIj2yEfm14O0L9kcQJCIW2Cg==.sig.ed25519',
  }

  const nativeMsg = bendybutt.toNativeMsg(msg)
  t.equal(Buffer.isBuffer(nativeMsg), true, 'buffer')
  const msg2 = bendybutt.fromNativeMsg(nativeMsg)
  t.deepEqual(msg2, msg, 'properly decoded')

  t.end()
})

tape('timestamps are unsigned', function (t) {
  const msg = {
    previous:
      'ssb:message/bendybutt-v1/H3MlLmVPVgHU6rBSzautUBZibDttkI-cU4lAFUIM8Ag=',
    author:
      'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=',
    sequence: 2,
    timestamp: Date.parse('01 Jan 2080 00:00:00 GMT'),
    content: {
      type: 'metafeed/add/existing',
      feedpurpose: 'test',
      subfeed:
        'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=',
      classichash: '%H3MlLmVPVgHU6rBSzautUBZibDttkI+cU4lAFUIM8Ag=.sha256',
      bool: true,
      tangles: {
        metafeed: {
          root: null,
          previous: [
            'ssb:message/bendybutt-v1/H3MlLmVPVgHU6rBSzautUBZibDttkI-cU4lAFUIM8Ag=',
          ],
        },
      },
    },
    contentSignature:
      'K1PgBYX64NUB6bBzcfu4BPEJtjl/Y+PZx7h/y94k6OjqCR9dIHXzjdiM4P7terusbSO464spYjz/LwvP4nqzAg==.sig.ed25519',
    signature:
      'F/XZ1uOwXNLKSHynxIvV/FUW1Fd9hIqxJw8TgTbMlf39SbVTwdRPdgxZxp9DoaMIj2yEfm14O0L9kcQJCIW2Cg==.sig.ed25519',
  }

  const nativeMsg = bendybutt.toNativeMsg(msg)
  t.equal(Buffer.isBuffer(nativeMsg), true, 'buffer')
  const msg2 = bendybutt.fromNativeMsg(nativeMsg)
  t.equal(msg2.timestamp, 3471292800000)
  t.deepEqual(msg2, msg, 'properly decoded')

  t.end()
})

tape('encodeNew', function (t) {
  const mfKeys = {
    curve: 'ed25519',
    public: 'XCesbvDN+9D4momhtlo2BHejPsect6sUzZB2JVm+4v8=.ed25519',
    private:
      'GDwNJNpspHpSwT5BRXoHXj0kmFcRRB31DE5MZPeWUStcJ6xu8M370PiaiaG2WjYEd6M+x5y3qxTNkHYlWb7i/w==.ed25519',
    id: 'ssb:feed/bendybutt-v1/XCesbvDN-9D4momhtlo2BHejPsect6sUzZB2JVm-4v8=',
  }

  const mainKeys = {
    curve: 'ed25519',
    public: 'd/zDvFswFbQaYJc03i47C9CgDev+/A8QQSfG5l/SEfw=.ed25519',
    private:
      'BSq6H1RYSU9PfFjE40TuvEeHiiAWBr6ec8w6lM93f3Z3/MO8WzAVtBpglzTeLjsL0KAN6/78DxBBJ8bmX9IR/A==.ed25519',
    id: '@d/zDvFswFbQaYJc03i47C9CgDev+/A8QQSfG5l/SEfw=.ed25519',
  }

  const mainContent = {
    type: 'metafeed/add/existing',
    feedpurpose: 'main',
    subfeed: mainKeys.id,
    tangles: {
      metafeed: {
        root: null,
        previous: null,
      },
    },
  }

  const nativeMsg = bendybutt.newNativeMsg({
    keys: mfKeys,
    contentKeys: mainKeys,
    content: mainContent,
    timestamp: 12345,
    previous: null,
    hmacKey: null,
  })

  const msgVal1 = bendybutt.fromNativeMsg(nativeMsg)
  const msg1ID = bendybutt.getMsgId(nativeMsg)

  t.equal(msgVal1.author, mfKeys.id, 'author is correct')
  t.equal(msgVal1.sequence, 1, 'sequence is correct')
  t.equal(msgVal1.previous, null, 'previous is correct')
  t.equal(msgVal1.timestamp, 12345, 'timestamp is correct')
  t.equal(msgVal1.signature.substr(0, 6), 'clLLuA', 'signature is correct')
  t.deepEquals(msgVal1.content, mainContent, 'content is correct')
  t.equal(msgVal1.contentSignature.substr(0, 6), 'TQPZuS', 'contentSignature')

  const indexesKeys = {
    curve: 'ed25519',
    public: '0gC5X4ztZ/YDhTJYbv5ZqPhhvI85Fc8uPSI0tE2p6fw=.ed25519',
    private:
      'giYugk0/HPu3H/NcW6OSVFNXYC5sN0UwJ7VXASjKVF/SALlfjO1n9gOFMlhu/lmo+GG8jzkVzy49IjS0Tanp/A==.ed25519',
    id: 'ssb:feed/bendybutt-v1/0gC5X4ztZ_YDhTJYbv5ZqPhhvI85Fc8uPSI0tE2p6fw=',
  }

  const indexesContent = {
    type: 'metafeed/add/derived',
    feedpurpose: 'indexes',
    subfeed: indexesKeys.id,
    tangles: {
      metafeed: {
        root: null,
        previous: null,
      },
    },
  }

  const nativeMsg2 = bendybutt.newNativeMsg({
    content: indexesContent,
    contentKeys: indexesKeys,
    keys: mfKeys,
    previous: { key: msg1ID, value: msgVal1 },
    hmacKey: null,
    timestamp: 23456,
  })

  const msgVal2 = bendybutt.fromNativeMsg(nativeMsg2)

  t.equal(msgVal2.author, mfKeys.id, 'author is correct')
  t.equal(msgVal2.sequence, 2, 'sequence is correct')
  t.equal(msgVal2.previous, msg1ID, 'previous is correct')
  t.equal(msgVal2.timestamp, 23456, 'timestamp is correct')
  t.equal(msgVal2.signature.substr(0, 6), 'bHZmOX', 'signature is correct')
  t.deepEquals(msgVal2.content, indexesContent, 'content is correct')
  t.equal(msgVal2.contentSignature.substr(0, 6), '0/J3F5', 'contentSignature')

  const msgVal2network = bendybutt.fromNativeMsg(bendybutt.toNativeMsg(msgVal2))
  t.deepEqual(msgVal2, msgVal2network)

  const hmacKey = Buffer.from(
    '6jAQ1AdRCabUHV+e7tVRUuYrwr1AcCmidB1AhMyGM60=',
    'base64'
  )

  const nativeMsg3 = bendybutt.newNativeMsg({
    content: mainContent,
    keys: mfKeys,
    contentKeys: mainKeys,
    timestamp: 12345,
    hmacKey,
    previous: null,
  })

  const msgVal3 = bendybutt.fromNativeMsg(nativeMsg3)
  const msg3ID = bendybutt.getMsgId(nativeMsg3)

  t.equal(msgVal3.author, mfKeys.id, 'author is correct')
  t.equal(msgVal3.sequence, 1, 'sequence is correct')
  t.equal(msgVal3.previous, null, 'previous is correct')
  t.equal(msgVal3.timestamp, 12345, 'timestamp is correct')
  t.equal(msgVal3.signature.substr(0, 6), 'zITgaq', 'signature is correct')
  t.notEqual(
    msgVal1.signature,
    msgVal3.signature,
    'hmac signature is different'
  )
  t.deepEquals(msgVal3.content, mainContent, 'content is correct')
  t.notEqual(
    msgVal1.contentSignature,
    msgVal3.contentSignature,
    'hmac contentSignature is different'
  )

  t.end()
})
