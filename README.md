# SSB Bendy Butt

Implementation of [bendy butt] in JS

## API

### decode(bbmsg)

Takes a bencoded message and returns an object compatible with the shape of
`msg.value` under classic SSB feeds.

### encode(msgVal)

Takes an object compatible with the shape of `msg.value` under classic SSB feeds
and returns a bencoded message Buffer.

### encodeNew(content, contentKeys, keys, sequence, previousMsgId, timestamp, hmacKey?, boxer?)

Creates a bencoded message Buffer for a new message to be appended to the bendy
butt feed owned by the author identified by `keys`.

Takes an arbitrary `content` object and an (optional) `contentKeys` which is
used to sign the content. If `contentKeys` is missing, the signature will be
done using `keys` instead. The other arguments comprise the metadata section of
the bendy-butt message, i.e. `author` (deduced from `keys`), `sequence`,
`previousMsgId` and `timestamp`.

Finally, if the new message is meant to be encrypted to some recipients
(determined by `content.recps`, an array of feed IDs), then `encodeNew` needs a
`boxer` function of type `(bbAuthor, bbContentSection, bbPreviousMsgId, recps) => string (.box2)`.
The arguments `bbAuthor`, `bbContentSection` and `bbPreviousMsgId` must be
encoded in `bencode` and BFE, and `recps` is the array of recipient IDs.

### validateSingle(msgVal, previousMsg?, hmacKey?)

Takes an unencoded object compatible with the shape of `msg.value` under classic SSB feeds and performs validation according to the criteria defined in the [bendy butt spec](https://github.com/ssb-ngi-pointer/bendy-butt-spec#specification).

The `previousMsg` parameter is optional and can be omitted if the message being validated is the first message on a feed (`sequence` is `1`). In all other cases it is required. The `hmacKey` is also optional and is only required if an HMAC value was supplied to `encodeNew()` when the message being validated was created.

In the event of successful validation, an `undefined` value is returned.

If validation fails, an `Error` object is returned with `Error.message` describing the failure.

### decodeAndValidateSingle(bbmsg, previousMsg?, hmacKey?)

Takes a bencoded message Buffer consisting of BFE-encoded values, decodes it and performs validation according to the criteria defined in the [bendy butt spec](https://github.com/ssb-ngi-pointer/bendy-butt-spec#specification).

The `previousMsg` parameter is optional and can be omitted if the message being validated is the first message on a feed (`sequence` is `1`). In all other cases it is required. The `hmacKey` is also optional and is only required if an HMAC value was supplied to `encodeNew()` when the message being validated was created.

In the event of successful validation, the decoded `msgVal` object is returned with fields for `author`, `sequence`, `previous`, `timestamp`, `signature` and `content`.

If validation fails, an `Error` object is returned with `Error.message` describing the failure.

### hash(msgVal)

Calculate the message key (as a sigil-based string) for the given "msg value"
(an object with the shape `msg.value` as known in classic SSB feeds).

### decodeBox2(decryptedBox2)

Takes a buffer of decrypted box2 content and decodes that into an
array of content and content signature.


[bendy butt]: https://github.com/ssb-ngi-pointer/bendy-butt-spec
