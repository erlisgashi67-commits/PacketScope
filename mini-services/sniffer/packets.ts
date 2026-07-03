/**
 * packets.ts — Real binary network packet construction & parsing.
 *
 * This module builds actual byte-level frames following the RFCs:
 *   - Ethernet II frame (14 bytes): dst MAC, src MAC, EtherType
 *   - IPv4 header (20 bytes min): RFC 791
 *   - TCP header (20 bytes min): RFC 793
 *   - UDP header (8 bytes): RFC 768
 *   - ICMP header (4 bytes min): RFC 792
 *
 * Every packet is assembled as a real Node Buffer with correct offsets,
 * then parsed back by reading raw bytes at those offsets. The hex dump
 * shown in the UI is the genuine raw bytes of the frame — not a mock.
 */

// ---------------------------------------------------------------------------
// Low-level big-endian read/write helpers (operate on raw byte offsets)
// ---------------------------------------------------------------------------

export function writeUint16BE(buf: Buffer, value: number, offset: number) {
  buf[offset] = (value >> 8) & 0xff
  buf[offset + 1] = value & 0xff
}

export function writeUint32BE(buf: Buffer, value: number, offset: number) {
  buf[offset] = (value >>> 24) & 0xff
  buf[offset + 1] = (value >>> 16) & 0xff
  buf[offset + 2] = (value >>> 8) & 0xff
  buf[offset + 3] = value & 0xff
}

export function readUint16BE(buf: Buffer, offset: number): number {
  return ((buf[offset] << 8) | buf[offset + 1]) >>> 0
}

export function readUint32BE(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] << 24) >>> 0) |
    (buf[offset + 1] << 16) |
    (buf[offset + 2] << 8) |
    buf[offset + 3]
  ) >>> 0
}

// ---------------------------------------------------------------------------
// TCP flag bit masks (RFC 793, byte 13 of the TCP header)
// ---------------------------------------------------------------------------

export const TCP_FLAGS = {
  FIN: 0x01,
  SYN: 0x02,
  RST: 0x04,
  PSH: 0x08,
  ACK: 0x10,
  URG: 0x20,
  ECE: 0x40,
  CWR: 0x80,
} as const

export function decodeTcpFlags(byte13: number): string[] {
  const flags: string[] = []
  if (byte13 & TCP_FLAGS.FIN) flags.push('FIN')
  if (byte13 & TCP_FLAGS.SYN) flags.push('SYN')
  if (byte13 & TCP_FLAGS.RST) flags.push('RST')
  if (byte13 & TCP_FLAGS.PSH) flags.push('PSH')
  if (byte13 & TCP_FLAGS.ACK) flags.push('ACK')
  if (byte13 & TCP_FLAGS.URG) flags.push('URG')
  if (byte13 & TCP_FLAGS.ECE) flags.push('ECE')
  if (byte13 & TCP_FLAGS.CWR) flags.push('CWR')
  return flags
}

export function encodeTcpFlags(flags: string[]): number {
  let b = 0
  for (const f of flags) {
    if (f in TCP_FLAGS) b |= (TCP_FLAGS as any)[f]
  }
  return b
}

// ---------------------------------------------------------------------------
// IP protocol numbers
// ---------------------------------------------------------------------------

export const IP_PROTOCOLS: Record<number, string> = {
  1: 'ICMP',
  6: 'TCP',
  17: 'UDP',
}

// ---------------------------------------------------------------------------
// Parsed packet shape (sent to the frontend over the websocket)
// ---------------------------------------------------------------------------

export interface ParsedPacket {
  id: number
  timestamp: number
  iface: string
  length: number
  eth: {
    dstMac: string
    srcMac: string
    etherType: string
  }
  ip?: {
    version: number
    headerLength: number
    ttl: number
    protocol: string
    protocolNumber: number
    srcIp: string
    dstIp: string
    totalLength: number
    identification: number
    flags: string
  }
  transport?: {
    protocol: string
    srcPort?: number
    dstPort?: number
    seq?: number
    ack?: number
    flags?: string[]
    window?: number
    length?: number
    icmpType?: string
    icmpCode?: number
  }
  application?: {
    protocol: string
    info: string
    details?: Record<string, unknown>
  }
  hex: string
  ascii: string
  rawLength: number
}

// ---------------------------------------------------------------------------
// Pcap-style hex + ASCII dump formatter (16 bytes per line, two columns)
// ---------------------------------------------------------------------------

export function formatHexDump(buf: Buffer, maxBytes = 256): string {
  const len = Math.min(buf.length, maxBytes)
  const lines: string[] = []
  for (let i = 0; i < len; i += 16) {
    const chunk = buf.subarray(i, Math.min(i + 16, len))
    const offset = i.toString(16).padStart(4, '0')
    let hexPart = ''
    for (let j = 0; j < 16; j++) {
      if (j === 8) hexPart += ' '
      if (j < chunk.length) hexPart += chunk[j].toString(16).padStart(2, '0') + ' '
      else hexPart += '   '
    }
    let asciiPart = ''
    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j]
      asciiPart += c >= 32 && c <= 126 ? String.fromCharCode(c) : '.'
    }
    lines.push(`${offset}  ${hexPart} |${asciiPart}|`)
  }
  if (buf.length > maxBytes) {
    lines.push(`... (${buf.length - maxBytes} more bytes)`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// MAC / IP formatting helpers
// ---------------------------------------------------------------------------

export function formatMac(bytes: Buffer): string {
  return Array.from(bytes.subarray(0, 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':')
}

export function formatIp(bytes: Buffer, offset: number): string {
  return `${bytes[offset]}.${bytes[offset + 1]}.${bytes[offset + 2]}.${bytes[offset + 3]}`
}

export function ipToBuffer(ip: string): Buffer {
  const parts = ip.split('.').map(Number)
  return Buffer.from([parts[0], parts[1], parts[2], parts[3]])
}

// ---------------------------------------------------------------------------
// IPv4 header checksum (one's complement of the one's complement sum)
// ---------------------------------------------------------------------------

export function ipChecksum(buf: Buffer, offset: number, length: number): number {
  let sum = 0
  for (let i = 0; i < length; i += 2) {
    sum += readUint16BE(buf, offset + i)
  }
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16)
  return (~sum) & 0xffff
}

// ---------------------------------------------------------------------------
// Build a full Ethernet/IPv4/Transport frame as a real Buffer
// ---------------------------------------------------------------------------

export interface BuildOptions {
  srcMac: string
  dstMac: string
  srcIp: string
  dstIp: string
  ttl: number
  protocol: number // IP protocol number
  identification: number
  // transport
  srcPort?: number
  dstPort?: number
  seq?: number
  ack?: number
  tcpFlags?: string[]
  window?: number
  icmpType?: number
  icmpCode?: number
  // payload
  payload: Buffer
}

export function buildFrame(opts: BuildOptions): Buffer {
  const macToBytes = (mac: string) =>
    Buffer.from(mac.split(':').map((h) => parseInt(h, 16)))

  const ethLen = 14
  const ipLen = 20
  let transportLen = 0
  if (opts.protocol === 6) transportLen = 20 // TCP
  else if (opts.protocol === 17) transportLen = 8 // UDP
  else if (opts.protocol === 1) transportLen = 8 // ICMP

  const totalLen = ethLen + ipLen + transportLen + opts.payload.length
  const buf = Buffer.alloc(totalLen)
  let off = 0

  // ---- Ethernet header ----
  macToBytes(opts.dstMac).copy(buf, off)
  off += 6
  macToBytes(opts.srcMac).copy(buf, off)
  off += 6
  writeUint16BE(buf, 0x0800, off) // EtherType IPv4
  off += 2

  // ---- IPv4 header ----
  const ipStart = off
  buf[off] = (4 << 4) | 5 // version 4, IHL 5 (20 bytes)
  buf[off + 1] = 0 // DSCP/ECN
  writeUint16BE(buf, ipLen + transportLen + opts.payload.length, off + 2) // total length
  writeUint16BE(buf, opts.identification & 0xffff, off + 4)
  writeUint16BE(buf, 0x4000, off + 6) // flags: Don't Fragment
  buf[off + 8] = opts.ttl
  buf[off + 9] = opts.protocol
  writeUint16BE(buf, 0, off + 10) // checksum placeholder
  ipToBuffer(opts.srcIp).copy(buf, off + 12)
  ipToBuffer(opts.dstIp).copy(buf, off + 16)
  const cksum = ipChecksum(buf, ipStart, ipLen)
  writeUint16BE(buf, cksum, off + 10)
  off += ipLen

  // ---- Transport header ----
  if (opts.protocol === 6) {
    // TCP
    writeUint16BE(buf, opts.srcPort || 0, off)
    writeUint16BE(buf, opts.dstPort || 0, off + 2)
    writeUint32BE(buf, opts.seq || 0, off + 4)
    writeUint32BE(buf, opts.ack || 0, off + 8)
    buf[off + 12] = (5 << 4) | 0 // data offset 5 (20 bytes)
    buf[off + 13] = encodeTcpFlags(opts.tcpFlags || [])
    writeUint16BE(buf, opts.window || 64240, off + 14)
    writeUint16BE(buf, 0, off + 16) // checksum
    writeUint16BE(buf, 0, off + 18) // urgent ptr
    off += 20
  } else if (opts.protocol === 17) {
    // UDP
    writeUint16BE(buf, opts.srcPort || 0, off)
    writeUint16BE(buf, opts.dstPort || 0, off + 2)
    writeUint16BE(buf, 8 + opts.payload.length, off + 4) // length
    writeUint16BE(buf, 0, off + 6) // checksum
    off += 8
  } else if (opts.protocol === 1) {
    // ICMP
    buf[off] = opts.icmpType || 8
    buf[off + 1] = opts.icmpCode || 0
    writeUint16BE(buf, 0, off + 2) // checksum
    writeUint16BE(buf, 0x0001, off + 4) // identifier
    writeUint16BE(buf, (opts.identification & 0xff) + 1, off + 6) // seq
    off += 8
  }

  // ---- Payload ----
  opts.payload.copy(buf, off)

  return buf
}

// ---------------------------------------------------------------------------
// Parse a raw frame Buffer back into a structured ParsedPacket (minus metadata)
// ---------------------------------------------------------------------------

const ICMP_TYPES: Record<number, string> = {
  0: 'Echo Reply',
  8: 'Echo Request',
  3: 'Dest Unreachable',
  11: 'Time Exceeded',
}

// Well-known port → application protocol inference
const PORT_APPS: Record<number, string> = {
  20: 'FTP-DATA',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP',
  68: 'DHCP',
  80: 'HTTP',
  110: 'POP3',
  123: 'NTP',
  143: 'IMAP',
  161: 'SNMP',
  389: 'LDAP',
  443: 'HTTPS',
  465: 'SMTPS',
  587: 'SMTP',
  636: 'LDAPS',
  853: 'DoT',
  993: 'IMAPS',
  995: 'POP3S',
  5222: 'XMPP',
  5353: 'mDNS',
  8080: 'HTTP-ALT',
  8443: 'HTTPS-ALT',
}

export function inferAppProtocol(srcPort: number, dstPort: number): string {
  if (PORT_APPS[dstPort]) return PORT_APPS[dstPort]
  if (PORT_APPS[srcPort]) return PORT_APPS[srcPort]
  return ''
}

export function parseFrame(
  buf: Buffer,
  meta: { id: number; timestamp: number; iface: string },
): ParsedPacket {
  const pkt: ParsedPacket = {
    id: meta.id,
    timestamp: meta.timestamp,
    iface: meta.iface,
    length: buf.length,
    eth: {
      dstMac: formatMac(buf.subarray(0, 6)),
      srcMac: formatMac(buf.subarray(6, 12)),
      etherType: readUint16BE(buf, 12) === 0x0800 ? 'IPv4' : 'Other',
    },
    hex: formatHexDump(buf),
    ascii: '',
    rawLength: buf.length,
  }

  let off = 14
  if (pkt.eth.etherType === 'IPv4' && buf.length >= off + 20) {
    const version = (buf[off] >> 4) & 0xf
    const ihl = buf[off] & 0xf
    const headerLength = ihl * 4
    const totalLength = readUint16BE(buf, off + 2)
    const identification = readUint16BE(buf, off + 4)
    const flagsWord = readUint16BE(buf, off + 6)
    const flagStr: string[] = []
    if (flagsWord & 0x8000) flagStr.push('Reserved')
    if (flagsWord & 0x4000) flagStr.push('DF')
    if (flagsWord & 0x2000) flagStr.push('MF')
    const ttl = buf[off + 8]
    const protocolNumber = buf[off + 9]
    const protocol = IP_PROTOCOLS[protocolNumber] || `Proto(${protocolNumber})`
    const srcIp = formatIp(buf, off + 12)
    const dstIp = formatIp(buf, off + 16)

    pkt.ip = {
      version,
      headerLength,
      ttl,
      protocol,
      protocolNumber,
      srcIp,
      dstIp,
      totalLength,
      identification,
      flags: flagStr.join(',') || 'None',
    }

    const transportOff = off + headerLength
    if (protocolNumber === 6 && buf.length >= transportOff + 20) {
      // TCP
      const srcPort = readUint16BE(buf, transportOff)
      const dstPort = readUint16BE(buf, transportOff + 2)
      const seq = readUint32BE(buf, transportOff + 4)
      const ack = readUint32BE(buf, transportOff + 8)
      const dataOffset = (buf[transportOff + 12] >> 4) * 4
      const flags = decodeTcpFlags(buf[transportOff + 13])
      const window = readUint16BE(buf, transportOff + 14)
      pkt.transport = { protocol: 'TCP', srcPort, dstPort, seq, ack, flags, window }
      const appProto = inferAppProtocol(srcPort, dstPort)
      if (appProto) {
        pkt.application = buildAppLayer(appProto, buf, transportOff + dataOffset, flags)
      }
    } else if (protocolNumber === 17 && buf.length >= transportOff + 8) {
      // UDP
      const srcPort = readUint16BE(buf, transportOff)
      const dstPort = readUint16BE(buf, transportOff + 2)
      const udpLen = readUint16BE(buf, transportOff + 4)
      pkt.transport = { protocol: 'UDP', srcPort, dstPort, length: udpLen }
      const appProto = inferAppProtocol(srcPort, dstPort)
      if (appProto) {
        pkt.application = buildAppLayer(appProto, buf, transportOff + 8, [])
      }
    } else if (protocolNumber === 1 && buf.length >= transportOff + 8) {
      // ICMP
      const icmpType = buf[transportOff]
      const icmpCode = buf[transportOff + 1]
      pkt.transport = {
        protocol: 'ICMP',
        icmpType: ICMP_TYPES[icmpType] || `Type ${icmpType}`,
        icmpCode,
      }
      pkt.application = { protocol: 'ICMP', info: `${pkt.transport.icmpType} (code ${icmpCode})` }
    }
  }

  return pkt
}

function buildAppLayer(
  proto: string,
  buf: Buffer,
  payloadOff: number,
  tcpFlags: string[],
): ParsedPacket['application'] {
  const payload = buf.subarray(payloadOff)
  if (proto === 'DNS') {
    // DNS header: ID(2) flags(2) qdcount(2) ancount(2) nscount(2) arcount(2)
    if (payload.length >= 12) {
      const id = readUint16BE(payload, 0)
      const flags = readUint16BE(payload, 2)
      const qd = readUint16BE(payload, 4)
      const isResponse = (flags & 0x8000) !== 0
      // decode first question name
      let name = ''
      let i = 12
      while (i < payload.length && payload[i] !== 0) {
        const len = payload[i]
        if (i + 1 + len > payload.length) break
        name += payload.subarray(i + 1, i + 1 + len).toString('ascii') + '.'
        i += 1 + len
      }
      name = name.replace(/\.$/, '') || '<root>'
      return {
        protocol: 'DNS',
        info: `${isResponse ? 'Response' : 'Query'} id=0x${id.toString(16)} ${qd}Q ${name}`,
        details: { id, flags: '0x' + flags.toString(16), qdcount: qd, name, isResponse },
      }
    }
    return { protocol: 'DNS', info: 'DNS query' }
  }
  if (proto === 'HTTP' || proto === 'HTTP-ALT') {
    const text = payload.subarray(0, 80).toString('ascii').replace(/[\r\n]+/g, ' ').trim()
    return { protocol: 'HTTP', info: text.slice(0, 60) || 'HTTP data' }
  }
  if (proto === 'HTTPS' || proto === 'HTTPS-ALT') {
    // TLS: first byte 0x16 = Handshake
    const isHandshake = payload[0] === 0x16
    return {
      protocol: 'TLS',
      info: isHandshake
        ? `TLS Handshake (${['ClientHello', 'ServerHello'][payload[5] % 2] || 'Record'})`
        : `TLS Application Data (${payload.length}B)`,
    }
  }
  if (proto === 'SSH') {
    const text = payload.subarray(0, 24).toString('ascii').replace(/[\r\n]+/g, ' ')
    return { protocol: 'SSH', info: text.startsWith('SSH') ? text.slice(0, 24) : 'SSH encrypted' }
  }
  if (proto === 'NTP') {
    return { protocol: 'NTP', info: `NTP ${payload[1] === 3 ? 'client' : 'server'} v${payload[0] >> 3}` }
  }
  if (proto === 'mDNS') {
    return { protocol: 'mDNS', info: 'mDNS multicast' }
  }
  if (proto === 'DHCP') {
    return { protocol: 'DHCP', info: 'DHCP discover/offer' }
  }
  if (proto === 'SMTP' || proto === 'SMTPS') {
    return { protocol: proto, info: 'Mail transfer' }
  }
  return { protocol: proto, info: `${proto} data (${payload.length}B)` }
}
