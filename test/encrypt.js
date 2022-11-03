// SPDX-FileCopyrightText: 2022 Andre 'Staltz' Medeiros
//
// SPDX-License-Identifier: CC0-1.0

const tape = require('tape')
const box = require('ssb-box/format')
const bendybutt = require('../format')

tape('toNativeMsg supports box2 encrypted content', function (t) {
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

  const opts = {
    keys: mfKeys,
    contentKeys: mainKeys,
    content: mainContent,
    timestamp: 12345,
    previous: null,
    hmacKey: null,
  }

  const ptxt = bendybutt.toPlaintextBuffer(opts)
  const ctxt = box.encrypt(ptxt, { recps: [mainKeys.id] })

  const nativeMsg = bendybutt.newNativeMsg({
    ...opts,
    content: ctxt.toString('base64') + '.box',
  })

  bendybutt.validate(nativeMsg, null, null, (err) => {
    t.error(err, 'no validate error')

    const msgVal = bendybutt.fromNativeMsg(nativeMsg)
    const nativeMsg2 = bendybutt.toNativeMsg(msgVal)

    bendybutt.validate(nativeMsg2, null, null, (err) => {
      t.error(err, 'no validate error')
      t.end()
    })
  })
})
