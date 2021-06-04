const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const ssbKeys = require('ssb-keys')
const rimraf = require('rimraf')
const pull = require('pull-stream')
const tape = require('tape')
const fs = require('fs')
const path = require('path')

const mfff = require('../')

const { where, author, toPullStream } = require('ssb-db2/operators')

const dir = '/tmp/ssb-meta-feeds-feed-format'

rimraf.sync(dir)
fs.mkdirSync(dir, { recursive: true})

const keys = ssbKeys.loadOrCreateSync(path.join(dir, 'secret'))

let sbot = SecretStack({ appKey: caps.shs })
  .use(require('ssb-db2'))
  .call(null, {
    keys,
    path: dir,
  })
let db = sbot.db

const msg = {
  "previous": null,
  "author": "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1",
  "sequence": 0,
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
  "contentSignature": "nCxOZQo4Cu5+iN1TQyteoM7DmCJnn+6NSTH1YiGLJ2CsGVtI+YR5WkfoxV1cY+YLuvartCggMRb14K0UbqW8Ag==.sig.bbfeed-v1",
  "signature": "5qMS2B8tZNkHuBVuH41bylPf78cJkPPa3+xqjKUV6yue6nwelA282BOkIIXz/GfORvOG9NKAecaBldnA/B+6Cw==.sig.bbfeed-v1"
}

// note this test requires a hacked db2 instance to allow adding raw
// messages

tape('db2 works', function (t) {
  db.rawAdd({ key: ssbKeys.hash(mfff.encode(msg)), value: msg }, (err) => {
    db.onDrain(() => {
      pull(
        db.query(where(author('@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1')), toPullStream()),
        pull.collect((err2, results) => {
          t.equal(results.length, 1, 'found 1 message')
          t.equal(results[0].value.author, '@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.bbfeed-v1', 'correct msg')
          sbot.close(t.end)
        })
      )
    })
  })
})
