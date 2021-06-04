// FIXME: proper library for this

const STRINGTYPE = Buffer.concat([
  Buffer.from([6]),
  Buffer.from([0])
])
const BOOLTYPE = Buffer.concat([
  Buffer.from([6]),
  Buffer.from([1])
])
const BOOLTRUE = Buffer.from([1])
const NULLTYPE = Buffer.concat([
  Buffer.from([6]),
  Buffer.from([21])
])
const FEEDTYPE = Buffer.concat([
  Buffer.from([0]),
  Buffer.from([2])
])
const MSGTYPE = Buffer.concat([
  Buffer.from([1]),
  Buffer.from([2])
])
const SIGNATURETYPE = Buffer.concat([
  Buffer.from([4]),
  Buffer.from([0])
])

exports.encode = {
  feed(feed) {
    return Buffer.concat([
      FEEDTYPE,
      Buffer.from(feed.substring(1, feed.length-'.bbfeed-v1'.length), 'base64')
    ])
  },
  message(msg) {
    if (msg === null) {
      return MSGTYPE
    } else {
      return Buffer.concat([
        MSGTYPE,
        Buffer.from(msg.substring(1, msg.length-'.bbmsg-v1'.length), 'base64')
      ])
    }
  },
  signature(sig) {
    return Buffer.concat([
      SIGNATURETYPE,
      Buffer.from(sig.substring(0, sig.length-'.sig.bbfeed-v1'.length), 'base64')
    ])
  },
  convert(value) {
    if (Array.isArray(value)) {
      return value.map(x => exports.encode.convert(x))
    } else if (value === undefined || value === null) {
      return NULLTYPE
    } else if (!Buffer.isBuffer(value) && typeof value === 'object' && value !== null) {
      const converted = {}
      for (var k in value)
        converted[k] = exports.encode.convert(value[k])
      return converted
    } else if (typeof value === 'string') {
      if (value.startsWith('@') && value.endsWith('.bbfeed-v1'))
        return exports.encode.feed(value)
      else if (value.startsWith('%') && value.endsWith('.bbmsg-v1'))
        return exports.encode.message(value)
      else if (value.endsWith('.sig.bbfeed-v1'))
        return exports.encode.signature(value)
      else
        return exports.encode.string(value)
    } else if (typeof value == "boolean") {
      return exports.encode.boolean(value)
    } else // FIXME: more checks, including floats!
      return value
  },
  string(str) {
    return Buffer.concat([
      STRINGTYPE,
      Buffer.from(str) // utf8 default
    ])
  },
  boolean(bool) {
    return Buffer.concat([
      BOOLTYPE,
      Buffer.from([bool ? 1 : 0])
    ])
  }
}

exports.decode = {
  feed(benc) {
    return '@' + benc.slice(2).toString('base64') + '.bbfeed-v1'
  },
  message(benc) {
    if (benc.length == 2) return null
    else return '%' + benc.slice(2).toString('base64') + '.bbmsg-v1'
  },
  signature(benc) {
    return benc.slice(2).toString('base64') + '.sig.bbfeed-v1'
  },
  convert(value) {
    if (Array.isArray(value)) {
      return value.map(x => exports.decode.convert(x))
    } else if (Buffer.isBuffer(value)) {
      if (value.length < 2) throw "Buffer length < 2" + value
      if (value.slice(0, 2).equals(STRINGTYPE))
        return exports.decode.string(value)
      else if (value.slice(0, 2).equals(BOOLTYPE))
        return exports.decode.boolean(value)
      else if (value.slice(0, 2).equals(NULLTYPE))
        return null
      else if (value.slice(0, 2).equals(FEEDTYPE))
        return exports.decode.feed(value)
      else if (value.slice(0, 2).equals(MSGTYPE))
        return exports.decode.message(value)
      else if (value.slice(0, 2).equals(SIGNATURETYPE))
        return exports.decode.signature(value)
      else
        throw "Unknown buffer " + value
    } else if (typeof value === 'object' && value !== null) {
      const converted = {}
      for (var k in value)
        converted[k] = exports.decode.convert(value[k])
      return converted
    } else if (typeof value === 'string') {
      return value
    } else // FIXME: more checks, including floats!
      return value
  },
  string(benc) {
    return benc.slice(2).toString()
  },
  boolean(benc) {
    return benc.slice(2).equals(Buffer.from([1]))
  }
}
