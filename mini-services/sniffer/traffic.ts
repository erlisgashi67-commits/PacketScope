/**
 * traffic.ts — Realistic network traffic simulation.
 *
 * Models a home/office network with a gateway router and several hosts,
 * producing realistic flow patterns: DNS lookups, TCP handshakes, HTTP/TLS
 * sessions, video streaming (large UDP), file downloads, NTP, mDNS, ICMP.
 *
 * Each call to `nextPacket()` returns a fully built binary Buffer that the
 * parser then dissects byte-by-byte — exactly like a real pcap capture.
 */

import { buildFrame, type BuildOptions } from './packets.js'

// A believable set of hosts on a 192.168.1.0/24 network
const HOSTS = [
  { ip: '192.168.1.10', mac: 'a4:83:e7:2c:91:0a', name: 'laptop' },
  { ip: '192.168.1.11', mac: 'b8:27:eb:3f:44:11', name: 'phone' },
  { ip: '192.168.1.20', mac: 'dc:a6:32:9e:01:20', name: 'desktop' },
  { ip: '192.168.1.30', mac: 'f0:18:98:4a:7b:30', name: 'tv' },
  { ip: '192.168.1.40', mac: '00:11:32:8c:5d:40', name: 'iot-cam' },
]
const GATEWAY = { ip: '192.168.1.1', mac: 'e0:3f:49:8a:c2:01', name: 'router' }

// Public endpoints the hosts talk to (simulated WAN)
const REMOTES = [
  { ip: '140.82.121.4', host: 'github.com' },
  { ip: '151.101.1.69', host: 'reddit.com' },
  { ip: '104.18.32.47', host: 'cloudflare.com' },
  { ip: '142.250.190.78', host: 'google.com' },
  { ip: '185.199.108.153', host: 'cdn.jsdelivr.net' },
  { ip: '23.235.39.44', host: 'fastly-cdn.com' },
  { ip: '13.107.42.14', host: 'office365.com' },
  { ip: '20.190.159.23', host: 'teams.microsoft.com' },
  { ip: '208.67.222.222', host: 'opendns.com' },
  { ip: '91.198.174.192', host: 'wikipedia.org' },
  { ip: '151.101.0.81', host: 'stack.imgur.com' },
  { ip: '199.232.46.132', host: 'npm-registry.com' },
]

const DNS_SERVER = { ip: '8.8.8.8', host: 'dns.google' }
const NTP_SERVER = { ip: '129.6.15.30', host: 'time-a.nist.gov' }

// Common ephemeral source ports
function ephemeralPort(): number {
  return 49152 + Math.floor(Math.random() * 16000)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface Flow {
  host: (typeof HOSTS)[number]
  remote: (typeof REMOTES)[number]
  srcPort: number
  dstPort: number
  protocol: 'HTTPS' | 'HTTP' | 'STREAM' | 'DOWNLOAD'
  seq: number
  ack: number
  state: 'handshake' | 'established' | 'data' | 'closing' | 'done'
  step: number
  bytesRemaining: number
}

const activeFlows: Flow[] = []
let pktCounter = 0

function strPayload(s: string): Buffer {
  return Buffer.from(s, 'utf8')
}

function randomPayload(size: number): Buffer {
  const buf = Buffer.alloc(size)
  for (let i = 0; i < size; i++) buf[i] = Math.floor(Math.random() * 256)
  return buf
}

const HTTP_REQUESTS = [
  'GET / HTTP/1.1\r\nHost: {host}\r\nUser-Agent: Mozilla/5.0\r\nAccept: text/html\r\n\r\n',
  'GET /api/v1/feed HTTP/1.1\r\nHost: {host}\r\nAccept: application/json\r\n\r\n',
  'GET /static/app.js HTTP/1.1\r\nHost: {host}\r\n\r\n',
  'POST /login HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/json\r\n\r\n',
]

const DNS_QUERIES = [
  'github.com',
  'reddit.com',
  'api.github.com',
  'avatars.githubusercontent.com',
  'cdn.jsdelivr.net',
  'registry.npmjs.org',
  'login.microsoftonline.com',
  'teams.microsoft.com',
  'en.wikipedia.org',
  'i.imgur.com',
  'fonts.googleapis.com',
  'ssl.gstatic.com',
]

function buildDnsQuery(name: string, id: number): Buffer {
  // DNS header (12 bytes) + question
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id, 0)
  header.writeUInt16BE(0x0100, 2) // standard query, recursion desired
  header.writeUInt16BE(1, 4) // qdcount
  header.writeUInt16BE(0, 6)
  header.writeUInt16BE(0, 8)
  header.writeUInt16BE(0, 10)
  const labels = name.split('.')
  const parts: Buffer[] = [header]
  for (const label of labels) {
    parts.push(Buffer.from([label.length]))
    parts.push(Buffer.from(label, 'ascii'))
  }
  parts.push(Buffer.from([0]))
  const qtype = Buffer.alloc(4)
  qtype.writeUInt16BE(1, 0) // A record
  qtype.writeUInt16BE(1, 2) // IN class
  parts.push(qtype)
  return Buffer.concat(parts)
}

function buildDnsResponse(query: string, id: number): Buffer {
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id, 0)
  header.writeUInt16BE(0x8180, 2) // response, no error
  header.writeUInt16BE(1, 4) // qdcount
  header.writeUInt16BE(1, 6) // ancount
  header.writeUInt16BE(0, 8)
  header.writeUInt16BE(0, 10)
  const parts: Buffer[] = [header]
  for (const label of query.split('.')) {
    parts.push(Buffer.from([label.length]))
    parts.push(Buffer.from(label, 'ascii'))
  }
  parts.push(Buffer.from([0]))
  const q = Buffer.alloc(4)
  q.writeUInt16BE(1, 0)
  q.writeUInt16BE(1, 2)
  parts.push(q)
  // answer: pointer to question (0xc00c), type A, class IN, TTL 300, rdlength 4, IP
  const ans = Buffer.alloc(16)
  ans.writeUInt16BE(0xc00c, 0)
  ans.writeUInt16BE(1, 2)
  ans.writeUInt16BE(1, 4)
  ans.writeUInt32BE(300, 6)
  ans.writeUInt16BE(4, 10)
  const ipParts = pick(REMOTES).ip.split('.').map(Number)
  ans[12] = ipParts[0]
  ans[13] = ipParts[1]
  ans[14] = ipParts[2]
  ans[15] = ipParts[3]
  parts.push(ans)
  return Buffer.concat(parts)
}

let pendingDnsQueries: { host: (typeof HOSTS)[number]; name: string; id: number; ts: number }[] = []

function spawnFlow(): Flow | null {
  if (activeFlows.length > 8) return null
  const host = pick(HOSTS)
  const remote = pick(REMOTES)
  const protocols: Flow['protocol'][] = ['HTTPS', 'HTTPS', 'HTTP', 'STREAM', 'DOWNLOAD', 'HTTPS']
  const protocol = pick(protocols)
  const dstPort = protocol === 'HTTP' ? 80 : protocol === 'STREAM' ? 8000 : 443
  return {
    host,
    remote,
    srcPort: ephemeralPort(),
    dstPort,
    protocol,
    seq: Math.floor(Math.random() * 0xffffffff),
    ack: 0,
    state: 'handshake',
    step: 0,
    bytesRemaining:
      protocol === 'STREAM'
        ? 50_000 + Math.floor(Math.random() * 200_000)
        : protocol === 'DOWNLOAD'
        ? 100_000 + Math.floor(Math.random() * 500_000)
        : 2000 + Math.floor(Math.random() * 8000),
  }
}

/**
 * Produce the next packet Buffer. Weighted scenario selection keeps the
 * capture looking like genuine mixed traffic.
 */
export function nextPacket(): Buffer {
  pktCounter++
  const roll = Math.random()

  // --- ICMP ping (≈6%) ---
  if (roll < 0.06) {
    const host = pick(HOSTS)
    const isReply = Math.random() < 0.5
    const src = isReply ? GATEWAY : host
    const dst = isReply ? host : GATEWAY
    return buildFrame({
      srcMac: src.mac,
      dstMac: dst.mac,
      srcIp: src.ip,
      dstIp: dst.ip,
      ttl: 64,
      protocol: 1,
      identification: pktCounter,
      icmpType: isReply ? 0 : 8,
      icmpCode: 0,
      payload: randomPayload(32),
    })
  }

  // --- DNS (≈12%) ---
  if (roll < 0.18) {
    const host = pick(HOSTS)
    const name = pick(DNS_QUERIES)
    const id = pktCounter & 0xffff
    pendingDnsQueries.push({ host, name, id, ts: Date.now() })
    return buildFrame({
      srcMac: host.mac,
      dstMac: GATEWAY.mac,
      srcIp: host.ip,
      dstIp: DNS_SERVER.ip,
      ttl: 64,
      protocol: 17,
      identification: pktCounter,
      srcPort: ephemeralPort(),
      dstPort: 53,
      payload: buildDnsQuery(name, id),
    })
  }

  // --- DNS response (≈8%) ---
  if (roll < 0.26 && pendingDnsQueries.length > 0) {
    const q = pendingDnsQueries.shift()!
    return buildFrame({
      srcMac: GATEWAY.mac,
      dstMac: q.host.mac,
      srcIp: DNS_SERVER.ip,
      dstIp: q.host.ip,
      ttl: 54,
      protocol: 17,
      identification: pktCounter,
      srcPort: 53,
      dstPort: 49152 + (q.id % 1000),
      payload: buildDnsResponse(q.name, q.id),
    })
  }

  // --- NTP (≈4%) ---
  if (roll < 0.3) {
    const host = pick(HOSTS)
    const ntp = Buffer.alloc(48)
    ntp[0] = 0x1b // li=0, vn=3, mode=3 (client)
    return buildFrame({
      srcMac: host.mac,
      dstMac: GATEWAY.mac,
      srcIp: host.ip,
      dstIp: NTP_SERVER.ip,
      ttl: 64,
      protocol: 17,
      identification: pktCounter,
      srcPort: 123,
      dstPort: 123,
      payload: ntp,
    })
  }

  // --- mDNS multicast (≈3%) ---
  if (roll < 0.33) {
    const host = pick(HOSTS)
    const mdns = Buffer.alloc(20)
    mdns.writeUInt16BE(pktCounter & 0xffff, 0)
    mdns.writeUInt16BE(0, 2)
    mdns.writeUInt16BE(0, 4)
    mdns.writeUInt16BE(1, 6)
    return buildFrame({
      srcMac: host.mac,
      dstMac: '01:00:5e:00:00:fb',
      srcIp: host.ip,
      dstIp: '224.0.0.251',
      ttl: 255,
      protocol: 17,
      identification: pktCounter,
      srcPort: 5353,
      dstPort: 5353,
      payload: mdns,
    })
  }

  // --- TCP flow traffic (the rest) ---
  // Occasionally spawn a new flow
  if (activeFlows.length < 6 && Math.random() < 0.4) {
    const f = spawnFlow()
    if (f) activeFlows.push(f)
  }

  const flow = activeFlows.length ? pick(activeFlows) : null
  if (!flow) {
    // fallback: a plain TLS client hello
    const host = pick(HOSTS)
    const remote = pick(REMOTES)
    return buildFrame({
      srcMac: host.mac,
      dstMac: GATEWAY.mac,
      srcIp: host.ip,
      dstIp: remote.ip,
      ttl: 64,
      protocol: 6,
      identification: pktCounter,
      srcPort: ephemeralPort(),
      dstPort: 443,
      tcpFlags: ['SYN'],
      seq: 1000,
      payload: Buffer.alloc(0),
    })
  }

  return advanceFlow(flow)
}

function advanceFlow(flow: Flow): Buffer {
  const base: Omit<BuildOptions, 'payload' | 'tcpFlags' | 'seq' | 'ack'> = {
    srcMac: '',
    dstMac: '',
    srcIp: '',
    dstIp: '',
    ttl: 64,
    protocol: 6,
    identification: pktCounter,
    srcPort: flow.srcPort,
    dstPort: flow.dstPort,
  }

  switch (flow.state) {
    case 'handshake': {
      // SYN
      if (flow.step === 0) {
        flow.step++
        return buildFrame({
          ...base,
          srcMac: flow.host.mac,
          dstMac: GATEWAY.mac,
          srcIp: flow.host.ip,
          dstIp: flow.remote.ip,
          tcpFlags: ['SYN'],
          seq: flow.seq,
          payload: Buffer.alloc(0),
        })
      }
      // SYN-ACK (from remote, via gateway)
      if (flow.step === 1) {
        flow.step++
        flow.ack = flow.seq + 1
        flow.seq = Math.floor(Math.random() * 0xffffffff)
        return buildFrame({
          ...base,
          srcMac: GATEWAY.mac,
          dstMac: flow.host.mac,
          srcIp: flow.remote.ip,
          dstIp: flow.host.ip,
          srcPort: flow.dstPort,
          dstPort: flow.srcPort,
          tcpFlags: ['SYN', 'ACK'],
          seq: flow.seq,
          ack: flow.ack,
          payload: Buffer.alloc(0),
        })
      }
      // ACK
      flow.step = 0
      flow.state = 'established'
      flow.ack = flow.seq + 1
      flow.seq = flow.ack
      return buildFrame({
        ...base,
        srcMac: flow.host.mac,
        dstMac: GATEWAY.mac,
        srcIp: flow.host.ip,
        dstIp: flow.remote.ip,
        tcpFlags: ['ACK'],
        seq: flow.seq,
        ack: flow.ack,
        payload: Buffer.alloc(0),
      })
    }
    case 'established': {
      // Client sends request (HTTP) or TLS ClientHello
      const isHttp = flow.protocol === 'HTTP'
      const payload = isHttp
        ? strPayload(pick(HTTP_REQUESTS).replace('{host}', flow.remote.host))
        : flow.protocol === 'STREAM'
        ? Buffer.alloc(0)
        : ((): Buffer => {
            const ch = Buffer.alloc(80)
            ch[0] = 0x16 // handshake
            ch[5] = 0x01 // client hello
            return ch
          })()
      flow.seq += payload.length
      flow.state = 'data'
      flow.step = 0
      const flags = isHttp || flow.protocol === 'HTTPS' ? ['PSH', 'ACK'] : ['ACK']
      return buildFrame({
        ...base,
        srcMac: flow.host.mac,
        dstMac: GATEWAY.mac,
        srcIp: flow.host.ip,
        dstIp: flow.remote.ip,
        tcpFlags: flags,
        seq: flow.seq,
        ack: flow.ack,
        payload,
      })
    }
    case 'data': {
      // Stream chunks from remote → host, with occasional ACKs
      const fromRemote = flow.step % 2 === 0
      const chunkSize = Math.min(
        flow.bytesRemaining,
        flow.protocol === 'STREAM'
          ? 1200 + Math.floor(Math.random() * 600)
          : flow.protocol === 'DOWNLOAD'
          ? 1400
          : 400 + Math.floor(Math.random() * 600),
      )
      flow.bytesRemaining -= chunkSize
      if (fromRemote) {
        flow.seq += chunkSize
        flow.step++
        const payload =
          flow.protocol === 'HTTPS'
            ? ((): Buffer => {
                const p = randomPayload(chunkSize)
                p[0] = 0x17 // application data
                return p
              })()
            : flow.protocol === 'HTTP'
            ? strPayload(
                `HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: ${flow.bytesRemaining}\r\n\r\n`,
              ).subarray(0, chunkSize)
            : randomPayload(chunkSize)
        if (flow.bytesRemaining <= 0) flow.state = 'closing'
        return buildFrame({
          ...base,
          srcMac: GATEWAY.mac,
          dstMac: flow.host.mac,
          srcIp: flow.remote.ip,
          dstIp: flow.host.ip,
          srcPort: flow.dstPort,
          dstPort: flow.srcPort,
          tcpFlags: chunkSize > 0 ? ['PSH', 'ACK'] : ['ACK'],
          seq: flow.seq,
          ack: flow.ack,
          payload,
        })
      } else {
        // ACK from host
        flow.ack += chunkSize
        flow.step++
        return buildFrame({
          ...base,
          srcMac: flow.host.mac,
          dstMac: GATEWAY.mac,
          srcIp: flow.host.ip,
          dstIp: flow.remote.ip,
          tcpFlags: ['ACK'],
          seq: flow.seq,
          ack: flow.ack,
          payload: Buffer.alloc(0),
        })
      }
    }
    case 'closing': {
      if (flow.step === 0) {
        flow.step++
        return buildFrame({
          ...base,
          srcMac: flow.host.mac,
          dstMac: GATEWAY.mac,
          srcIp: flow.host.ip,
          dstIp: flow.remote.ip,
          tcpFlags: ['FIN', 'ACK'],
          seq: flow.seq,
          ack: flow.ack,
          payload: Buffer.alloc(0),
        })
      }
      if (flow.step === 1) {
        flow.step++
        return buildFrame({
          ...base,
          srcMac: GATEWAY.mac,
          dstMac: flow.host.mac,
          srcIp: flow.remote.ip,
          dstIp: flow.host.ip,
          srcPort: flow.dstPort,
          dstPort: flow.srcPort,
          tcpFlags: ['FIN', 'ACK'],
          seq: flow.seq + 1,
          ack: flow.ack + 1,
          payload: Buffer.alloc(0),
        })
      }
      flow.state = 'done'
      const idx = activeFlows.indexOf(flow)
      if (idx >= 0) activeFlows.splice(idx, 1)
      return buildFrame({
        ...base,
        srcMac: flow.host.mac,
        dstMac: GATEWAY.mac,
        srcIp: flow.host.ip,
        dstIp: flow.remote.ip,
        tcpFlags: ['ACK'],
        seq: flow.seq + 1,
        ack: flow.ack + 2,
        payload: Buffer.alloc(0),
      })
    }
  }
  // unreachable fallback
  const host = pick(HOSTS)
  return buildFrame({
    srcMac: host.mac,
    dstMac: GATEWAY.mac,
    srcIp: host.ip,
    dstIp: pick(REMOTES).ip,
    ttl: 64,
    protocol: 6,
    identification: pktCounter,
    srcPort: ephemeralPort(),
    dstPort: 443,
    tcpFlags: ['ACK'],
    payload: randomPayload(100),
  })
}

export function resetTraffic() {
  activeFlows.length = 0
  pendingDnsQueries = []
}
