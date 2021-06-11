# SSB meta feeds feed format

Implementation of [ssb-meta-feeds-format] in JS

## api

### decode(bbmsg)

Takes a bencoded message and returns a classic compatible json object

### encode(msg)

Takes a json message value and returns bencoded message buffer

### create(content, mfKeys, sfKeys, previous, sequence, timestamp)

FIXME: does not support encrypted content

Takes a content json object, meta feed keys, sub feed keys, the
previous message key on the meta feed or null, the next sequence
number and a timestamp and returns a classic compatible json object.


[ssb-meta-feeds-format]: https://github.com/ssb-ngi-pointer/bipfy-badger-spec
