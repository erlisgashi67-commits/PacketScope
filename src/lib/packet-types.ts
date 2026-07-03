// Shared packet types — mirror the structures emitted by the sniffer engine.

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

export interface CaptureStats {
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
  uptime: number
  capturing: boolean
  rate: number
}

export interface Snapshot {
  capturing: boolean
  rate: number
  recentPackets: ParsedPacket[]
  stats: CaptureStats
}

export type ProtocolFilter = 'ALL' | 'TCP' | 'UDP' | 'ICMP'

export interface PacketFilters {
  protocol: ProtocolFilter
  app: string
  search: string
}
