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
  Buffer.from([2])
])

const FEEDTYPE = Buffer.from([0])
const CLASSICFEEDTYPE = Buffer.concat([
  Buffer.from([0]),
  Buffer.from([0])
])
const GGFEEDTYPE = Buffer.concat([
  Buffer.from([0]),
  Buffer.from([1])
])
const BBFEEDTYPE = Buffer.concat([
  Buffer.from([0]),
  Buffer.from([3])
])

const MSGTYPE = Buffer.from([1])
const CLASSICMSGTYPE = Buffer.concat([
  Buffer.from([1]),
  Buffer.from([0])
])
const GGMSGTYPE = Buffer.concat([
  Buffer.from([1]),
  Buffer.from([1])
])
const BBMSGTYPE = Buffer.concat([
  Buffer.from([1]),
  Buffer.from([4])
])

const SIGNATURETYPE = Buffer.concat([
  Buffer.from([4]),
  Buffer.from([0])
])

const BOXTYPE = Buffer.from([5])
const BOX1TYPE = Buffer.concat([
  Buffer.from([5]),
  Buffer.from([0])
])
const BOX2TYPE = Buffer.concat([
  Buffer.from([5]),
  Buffer.from([1])
])

exports.encode = {
  feed(feed) {
    let feedtype
    if (feed.endsWith('.ed25519'))
      feedtype = CLASSICFEEDTYPE
    else if (feed.endsWith('.bbfeed-v1'))
      feedtype = BBFEEDTYPE
    else if (feed.endsWith('.ggfeed-v1'))
      feedtype = GGFEEDTYPE
    else throw "Unknown feed format", feed

    const dotIndex = feed.lastIndexOf('.')

    return Buffer.concat([
      feedtype,
      Buffer.from(feed.substring(1, dotIndex), 'base64')
    ])
  },
  message(msg) {
    if (msg === null) {
      return MSGTYPE
    } else {
      let msgtype
      if (msg.endsWith('.sha256'))
        msgtype = CLASSICMSGTYPE
      else if (msg.endsWith('.bbmsg-v1'))
        msgtype = BBMSGTYPE
      else if (msg.endsWith('.ggmsg-v1'))
        msgtype = GGMSGTYPE
      else throw "Unknown msg", msg

      const dotIndex = msg.lastIndexOf('.')

      return Buffer.concat([
        msgtype,
        Buffer.from(msg.substring(1, dotIndex), 'base64')
      ])
    }
  },
  box(value) {
    if (value.endsWith(".box"))
      return Buffer.concat([
        BOX1TYPE,
        Buffer.from(value.substring(0, value.length-'.box'.length), 'base64')
      ])
    else if (value.endsWith(".box2"))
      return Buffer.concat([
        BOX2TYPE,
        Buffer.from(value.substring(0, value.length-'.box2'.length), 'base64')
      ])
    else throw "Unknown box", value
  },
  signature(sig) {
    return Buffer.concat([
      SIGNATURETYPE,
      Buffer.from(sig.substring(0, sig.length-'.sig.ed25519'.length), 'base64')
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
      if (value.startsWith('@'))
        return exports.encode.feed(value)
      else if (value.startsWith('%'))
        return exports.encode.message(value)
      else if (value.endsWith('.sig.ed25519'))
        return exports.encode.signature(value)
      else if (value.endsWith('.box2') || value.endsWith('.box'))
        return exports.encode.box(value)
      else
        return exports.encode.string(value)
    } else if (typeof value == "boolean") {
      return exports.encode.boolean(value)
    } else {
      if (!Number.isInteger(value) && !Buffer.isBuffer(value))
        console.log("not encoding unknown value", value)
      // FIXME: more checks, including floats!
      return value
    }
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
  box(benc) {
    if (benc.slice(0, 2).equals(BOX1TYPE))
      return benc.slice(2).toString('base64') + '.box1'
    else if (benc.slice(0, 2).equals(BOX2TYPE))
      return benc.slice(2).toString('base64') + '.box2'
    else throw "Unknown box", benc
  },
  feed(benc) {
    let feedextension = ''
    if (benc.slice(0, 2).equals(CLASSICFEEDTYPE))
      feedextension = '.ed25519'
    else if (benc.slice(0, 2).equals(BBFEEDTYPE))
      feedextension = '.bbfeed-v1'
    else if (benc.slice(0, 2).equals(GGFEEDTYPE))
      feedextension = '.ggfeed-v1'
    else throw "Unknown feed", benc

    return '@' + benc.slice(2).toString('base64') + feedextension
  },
  message(benc) {
    if (benc.length == 2) return null

    let msgextension = ''
    if (benc.slice(0, 2).equals(CLASSICMSGTYPE))
      msgextension = '.ed25519'
    else if (benc.slice(0, 2).equals(BBMSGTYPE))
      msgextension = '.bbmsg-v1'
    else if (benc.slice(0, 2).equals(GGMSGTYPE))
      msgextension = '.ggmsg-v1'
    else throw "Unknown msg", benc

    return '%' + benc.slice(2).toString('base64') + msgextension
  },
  signature(benc) {
    return benc.slice(2).toString('base64') + '.sig.ed25519'
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
      else if (value.slice(0, 1).equals(FEEDTYPE))
        return exports.decode.feed(value)
      else if (value.slice(0, 1).equals(MSGTYPE))
        return exports.decode.message(value)
      else if (value.slice(0, 1).equals(BOXTYPE))
        return exports.decode.box(value)
      else if (value.slice(0, 2).equals(SIGNATURETYPE))
        return exports.decode.signature(value)
      else
        return value.toString('base64')
    } else if (typeof value === 'object' && value !== null) {
      const converted = {}
      for (var k in value)
        converted[k] = exports.decode.convert(value[k])
      return converted
    } else // FIXME: more checks, including floats!
      return value
  },
  string(benc) {
    return benc.slice(2).toString()
  },
  boolean(benc) {
    return benc.slice(2).equals(BOOLTRUE)
  }
}
