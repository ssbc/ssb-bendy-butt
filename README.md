# SSB meta feeds feed format

Implementation of [bendy butt] in JS

## api

### decode(bbmsg)

Takes a bencoded message and returns a classic compatible json object

### encode(msg)

Takes a json message value and returns bencoded message buffer

### create(content, mfKeys, sfKeys, previous, sequence, timestamp, boxer)

Takes a content json object, meta feed keys, sub feed keys, the
previous message key on the meta feed or null, the next sequence
number and a timestamp and returns a classic compatible json
object. Lastly it takes an boxer function of form (encodedAuthor,
encodedContent, encodedPrevious, recps) => string (.box2). The encoded
parts must be in BFE form and recps must be the ids of the recipients.

### decodeBox2(decryptedBox2)

Takes a buffer of decrypted box2 content and decodes that into an
array of content and content signature.


[bendy butt]: https://github.com/ssb-ngi-pointer/bendy-butt-spec
