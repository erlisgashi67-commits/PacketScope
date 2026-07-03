/**
 * index.ts — Packet capture engine & Socket.IO stream server.
 *
 * Runs on port 3001. Generates real binary network frames (see traffic.ts),
 * parses each one byte-by-byte (see packets.ts), and streams the structured
 * result + raw hex dump to every connected dashboard client.
 *
 * The frontend connects with: io('/?XTransformPort=3001')
 */

import { createServer } from 'http'
import { Server } from 'socket.io'
import { nextPacket, resetTraffic } from './traffic.js'
import { parseFrame, type ParsedPacket } from './packets.js'

const PORT = 3001

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------------------------------------------------------------------------
// Capture state
// ---------------------------------------------------------------------------

let capturing = true
let packetsPerSec = 18 // target packet rate
let packetId = 0
const recentPackets: ParsedPacket[] = [] // rolling buffer (last 500)

interface Stats {
  totalPackets: number
  totalBytes: number
  perProtocol: Record<string, number>
  perApp: Record<string, number>
  srcIps: Record<string, number>
  dstIps: Record<string, number>
  srcPorts: Record<string, number>
  dstPorts: Record<string, number>
  tcpFlags: Record<string, number>
  packetsLastSecond: number
  bytesLastSecond: number
  startTime: number
}

const stats: Stats = {
  totalPackets: 0,
  totalBytes: 0,
  perProtocol: {},
  perApp: {},
  srcIps: {},
  dstIps: {},
  srcPorts: {},
  dstPorts: {},
  tcpFlags: {},
  packetsLastSecond: 0,
  bytesLastSecond: 0,
  startTime: Date.now(),
}

let secondPackets = 0
let secondBytes = 0

function recordPacket(pkt: ParsedPacket) {
  stats.totalPackets++
  stats.totalBytes += pkt.length
  secondPackets++
  secondBytes += pkt.length

  const proto = pkt.transport?.protocol || pkt.ip?.protocol || 'Other'
  stats.perProtocol[proto] = (stats.perProtocol[proto] || 0) + 1

  const app = pkt.application?.protocol || '—'
  stats.perApp[app] = (stats.perApp[app] || 0) + 1

  if (pkt.ip) {
    stats.srcIps[pkt.ip.srcIp] = (stats.srcIps[pkt.ip.srcIp] || 0) + 1
    stats.dstIps[pkt.ip.dstIp] = (stats.dstIps[pkt.ip.dstIp] || 0) + 1
  }
  if (pkt.transport?.srcPort) {
    const k = String(pkt.transport.srcPort)
    stats.srcPorts[k] = (stats.srcPorts[k] || 0) + 1
  }
  if (pkt.transport?.dstPort) {
    const k = String(pkt.transport.dstPort)
    stats.dstPorts[k] = (stats.dstPorts[k] || 0) + 1
  }
  for (const f of pkt.transport?.flags || []) {
    stats.tcpFlags[f] = (stats.tcpFlags[f] || 0) + 1
  }

  recentPackets.push(pkt)
  if (recentPackets.length > 500) recentPackets.shift()
}

// ---------------------------------------------------------------------------
// Capture loop — emits one packet at a time, paced to packetsPerSec
// ---------------------------------------------------------------------------

let loopHandle: ReturnType<typeof setTimeout> | null = null

function scheduleNext() {
  if (!capturing) {
    loopHandle = null
    return
  }
  // jittered interval around the target rate
  const baseInterval = 1000 / Math.max(1, packetsPerSec)
  const jitter = baseInterval * 0.4 * (Math.random() - 0.5)
  const delay = Math.max(15, baseInterval + jitter)
  loopHandle = setTimeout(captureTick, delay)
}

function captureTick() {
  if (!capturing) {
    loopHandle = null
    return
  }
  // occasionally burst 1-3 packets for realism
  const burst = Math.random() < 0.15 ? 1 + Math.floor(Math.random() * 3) : 1
  for (let i = 0; i < burst; i++) {
    packetId++
    const raw = nextPacket()
    const pkt = parseFrame(raw, {
      id: packetId,
      timestamp: Date.now(),
      iface: 'eth0',
    })
    recordPacket(pkt)
    io.emit('packet', pkt)
  }
  scheduleNext()
}

// Per-second stats rollup
setInterval(() => {
  stats.packetsLastSecond = secondPackets
  stats.bytesLastSecond = secondBytes
  secondPackets = 0
  secondBytes = 0
  io.emit('stats', {
    totalPackets: stats.totalPackets,
    totalBytes: stats.totalBytes,
    perProtocol: stats.perProtocol,
    perApp: stats.perApp,
    srcIps: stats.srcIps,
    dstIps: stats.dstIps,
    srcPorts: stats.srcPorts,
    dstPorts: stats.dstPorts,
    tcpFlags: stats.tcpFlags,
    packetsLastSecond: stats.packetsLastSecond,
    bytesLastSecond: stats.bytesLastSecond,
    uptime: Date.now() - stats.startTime,
    capturing,
    rate: packetsPerSec,
  })
}, 1000)

// ---------------------------------------------------------------------------
// Connection handling
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[sniffer] dashboard connected: ${socket.id}`)

  // Send current state snapshot
  socket.emit('snapshot', {
    capturing,
    rate: packetsPerSec,
    recentPackets: recentPackets.slice(-100),
    stats: {
      totalPackets: stats.totalPackets,
      totalBytes: stats.totalBytes,
      perProtocol: stats.perProtocol,
      perApp: stats.perApp,
      srcIps: stats.srcIps,
      dstIps: stats.dstIps,
      srcPorts: stats.srcPorts,
      dstPorts: stats.dstPorts,
      tcpFlags: stats.tcpFlags,
      packetsLastSecond: stats.packetsLastSecond,
      bytesLastSecond: stats.bytesLastSecond,
      uptime: Date.now() - stats.startTime,
      capturing,
      rate: packetsPerSec,
    },
  })

  socket.on('start', () => {
    if (!capturing) {
      capturing = true
      console.log('[sniffer] capture started')
      scheduleNext()
      io.emit('capture-state', { capturing: true })
    }
  })

  socket.on('stop', () => {
    capturing = false
    if (loopHandle) {
      clearTimeout(loopHandle)
      loopHandle = null
    }
    console.log('[sniffer] capture stopped')
    io.emit('capture-state', { capturing: false })
  })

  socket.on('set-rate', (rate: number) => {
    packetsPerSec = Math.max(1, Math.min(200, Math.floor(rate)))
    console.log(`[sniffer] rate set to ${packetsPerSec} pps`)
  })

  socket.on('clear', () => {
    recentPackets.length = 0
    stats.totalPackets = 0
    stats.totalBytes = 0
    stats.perProtocol = {}
    stats.perApp = {}
    stats.srcIps = {}
    stats.dstIps = {}
    stats.srcPorts = {}
    stats.dstPorts = {}
    stats.tcpFlags = {}
    resetTraffic()
    packetId = 0
    stats.startTime = Date.now()
    io.emit('cleared')
    console.log('[sniffer] buffers cleared')
  })

  socket.on('disconnect', () => {
    console.log(`[sniffer] dashboard disconnected: ${socket.id}`)
  })

  socket.on('error', (err) => {
    console.error(`[sniffer] socket error (${socket.id}):`, err)
  })
})

// Kick off the capture loop
scheduleNext()

httpServer.listen(PORT, () => {
  console.log(`[sniffer] packet capture engine listening on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
