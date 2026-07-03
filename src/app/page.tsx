'use client'

import { useState } from 'react'
import { Radar, Activity, Terminal, ChevronDown } from 'lucide-react'
import { usePacketCapture } from '@/lib/use-packet-capture'
import { StatCards } from '@/components/sniffer/stat-cards'
import { CaptureControls } from '@/components/sniffer/capture-controls'
import { PacketStream } from '@/components/sniffer/packet-stream'
import { PacketDetail } from '@/components/sniffer/packet-detail'
import { ProtocolChart } from '@/components/sniffer/protocol-chart'
import { TrafficChart } from '@/components/sniffer/traffic-chart'
import { TopTalkers } from '@/components/sniffer/top-talkers'
import { PortUsage } from '@/components/sniffer/port-usage'
import { TcpFlags } from '@/components/sniffer/tcp-flags'

export default function SnifferDashboard() {
  const capture = usePacketCapture()
  const [autoScroll, setAutoScroll] = useState(true)

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 sniffer-grid-bg">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/30 blur-lg rounded-full" />
              <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center border border-emerald-400/40">
                <Radar className="h-5 w-5 text-zinc-950" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
                PacketScope
                <span className="text-[10px] font-mono text-emerald-400/80 border border-emerald-500/30 rounded px-1.5 py-0.5 bg-emerald-500/5">
                  v1.0
                </span>
              </h1>
              <p className="text-[11px] text-zinc-500 font-mono">
                Network Packet Sniffer &amp; Traffic Analyzer
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>iface</span>
              <span className="text-emerald-400">eth0</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>{capture.filteredPackets.length} shown</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  capture.connected ? 'bg-emerald-400' : 'bg-rose-400'
                } animate-pulse`}
              />
              <span className="text-zinc-400">
                engine {capture.connected ? 'online' : 'offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 space-y-4">
        {/* Stat cards */}
        <StatCards stats={capture.stats} connected={capture.connected} />

        {/* Capture controls */}
        <CaptureControls
          connected={capture.connected}
          capturing={capture.capturing}
          rate={capture.rate}
          filters={capture.filters}
          onStart={capture.start}
          onStop={capture.stop}
          onClear={capture.clear}
          onSetRate={capture.setCaptureRate}
          onSetProtocol={capture.setProtocolFilter}
          onSetApp={capture.setAppFilter}
          onSetSearch={capture.setSearch}
        />

        {/* Packet stream + detail */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden flex flex-col h-[440px]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/80">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Live Packet Stream
                </span>
                <span className="text-[10px] font-mono text-zinc-600">
                  {capture.filteredPackets.length} packets
                </span>
              </div>
              <button
                onClick={() => setAutoScroll((s) => !s)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  autoScroll
                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                auto-scroll: {autoScroll ? 'on' : 'off'}
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <PacketStream
                packets={capture.filteredPackets}
                selectedId={capture.selectedId}
                onSelect={capture.setSelectedId}
                autoScroll={autoScroll}
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden flex flex-col h-[440px]">
            <PacketDetail packet={capture.selectedPacket} />
          </div>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-auto lg:h-[260px]">
          <ProtocolChart stats={capture.stats} />
          <TrafficChart data={capture.traffic} />
          <TopTalkers stats={capture.stats} />
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-auto lg:h-[260px]">
          <PortUsage
            ports={capture.stats?.srcPorts || {}}
            title="Source Ports"
            accent="emerald"
          />
          <PortUsage
            ports={capture.stats?.dstPorts || {}}
            title="Destination Ports"
            accent="amber"
          />
          <TcpFlags stats={capture.stats} />
        </div>

        {/* Info banner */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Radar className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-wider font-semibold">
              How it works
            </span>
          </div>
          <p className="text-[12px] text-zinc-400 leading-relaxed flex-1">
            The capture engine assembles <span className="text-zinc-300 font-mono">real binary frames</span>{' '}
            (Ethernet / IPv4 / TCP / UDP / ICMP headers per RFC 791 &amp; 793), then dissects each one
            byte-by-byte — reading flags from bit offsets, IPs from 4-byte fields, and decoding DNS/HTTP/TLS
            payloads. The hex dump above is the genuine raw bytes of the selected frame.
          </p>
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  capture.connected && capture.capturing
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-zinc-600'
                }`}
              />
              {capture.connected
                ? capture.capturing
                  ? 'capture active'
                  : 'capture paused'
                : 'engine disconnected'}
            </span>
            <span className="text-zinc-700">·</span>
            <span>target {capture.rate} pps</span>
            <span className="text-zinc-700">·</span>
            <span>
              {capture.stats ? capture.stats.totalPackets.toLocaleString() : '0'} packets captured
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-600">
            <span>PacketScope — simulating network traffic for analysis</span>
            <ChevronDown className="h-3 w-3 rotate-180" />
          </div>
        </div>
      </footer>
    </div>
  )
}
