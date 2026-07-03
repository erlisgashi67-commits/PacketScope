'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  ParsedPacket,
  CaptureStats,
  Snapshot,
  PacketFilters,
  ProtocolFilter,
} from './packet-types'

const MAX_PACKETS = 400
const FLUSH_INTERVAL = 180 // ms — batch high-frequency packet events

export interface TrafficSample {
  t: number
  pps: number
  bps: number
}

export function usePacketCapture() {
  const [connected, setConnected] = useState(false)
  const [capturing, setCapturing] = useState(true)
  const [rate, setRate] = useState(18)
  const [packets, setPackets] = useState<ParsedPacket[]>([])
  const [stats, setStats] = useState<CaptureStats | null>(null)
  const [traffic, setTraffic] = useState<TrafficSample[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<PacketFilters>({
    protocol: 'ALL',
    app: 'ALL',
    search: '',
  })

  const socketRef = useRef<Socket | null>(null)
  const pendingPackets = useRef<ParsedPacket[]>([])
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---- connect ----
  useEffect(() => {
    const socket = io('/?XTransformPort=3001', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('snapshot', (snap: Snapshot) => {
      setCapturing(snap.capturing)
      setRate(snap.rate)
      setPackets(snap.recentPackets)
      setStats(snap.stats)
    })

    socket.on('packet', (pkt: ParsedPacket) => {
      pendingPackets.current.push(pkt)
      if (pendingPackets.current.length > 80) pendingPackets.current.shift()
    })

    socket.on('stats', (s: CaptureStats) => {
      setStats(s)
      setCapturing(s.capturing)
      setRate(s.rate)
      setTraffic((prev) => {
        const next = [
          ...prev,
          { t: Date.now(), pps: s.packetsLastSecond, bps: s.bytesLastSecond },
        ]
        return next.slice(-60)
      })
    })

    socket.on('capture-state', (d: { capturing: boolean }) => setCapturing(d.capturing))
    socket.on('cleared', () => {
      setPackets([])
      setTraffic([])
      setSelectedId(null)
    })

    // batched flush of pending packets
    flushTimer.current = setInterval(() => {
      if (pendingPackets.current.length === 0) return
      const batch = pendingPackets.current
      pendingPackets.current = []
      setPackets((prev) => {
        const merged = [...prev, ...batch]
        return merged.length > MAX_PACKETS ? merged.slice(-MAX_PACKETS) : merged
      })
    }, FLUSH_INTERVAL)

    return () => {
      socket.disconnect()
      if (flushTimer.current) clearInterval(flushTimer.current)
    }
  }, [])

  // ---- actions ----
  const start = useCallback(() => socketRef.current?.emit('start'), [])
  const stop = useCallback(() => socketRef.current?.emit('stop'), [])
  const clear = useCallback(() => socketRef.current?.emit('clear'), [])
  const setCaptureRate = useCallback(
    (r: number) => socketRef.current?.emit('set-rate', r),
    [],
  )

  const setProtocolFilter = useCallback(
    (p: ProtocolFilter) => setFilters((f) => ({ ...f, protocol: p })),
    [],
  )
  const setAppFilter = useCallback(
    (a: string) => setFilters((f) => ({ ...f, app: a })),
    [],
  )
  const setSearch = useCallback(
    (s: string) => setFilters((f) => ({ ...f, search: s })),
    [],
  )

  // ---- derived: filtered packets ----
  const filteredPackets = (() => {
    let list = packets
    if (filters.protocol !== 'ALL') {
      list = list.filter((p) => p.transport?.protocol === filters.protocol)
    }
    if (filters.app !== 'ALL') {
      list = list.filter((p) => p.application?.protocol === filters.app)
    }
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      list = list.filter((p) => {
        const hay = [
          p.ip?.srcIp,
          p.ip?.dstIp,
          p.transport?.srcPort,
          p.transport?.dstPort,
          p.application?.info,
          p.application?.protocol,
          p.transport?.flags?.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }
    return list
  })()

  const selectedPacket =
    selectedId != null ? packets.find((p) => p.id === selectedId) || null : null

  return {
    connected,
    capturing,
    rate,
    packets,
    filteredPackets,
    stats,
    traffic,
    selectedId,
    selectedPacket,
    filters,
    setSelectedId,
    start,
    stop,
    clear,
    setCaptureRate,
    setProtocolFilter,
    setAppFilter,
    setSearch,
  }
}
