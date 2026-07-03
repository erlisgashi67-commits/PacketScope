'use client'

import { Activity, Package, Gauge, Clock } from 'lucide-react'
import { formatBytes, formatRate, formatUptime } from '@/lib/packet-utils'
import type { CaptureStats } from '@/lib/packet-types'

interface Props {
  stats: CaptureStats | null
  connected: boolean
}

export function StatCards({ stats, connected }: Props) {
  const cards = [
    {
      label: 'Total Packets',
      value: stats ? stats.totalPackets.toLocaleString() : '—',
      icon: Package,
      accent: 'text-emerald-400',
      ring: 'border-emerald-500/20',
      glow: 'shadow-[0_0_24px_-8px_rgba(52,211,153,0.4)]',
      sub: stats ? `${Object.keys(stats.perProtocol).length} protocols seen` : 'no data',
    },
    {
      label: 'Traffic Volume',
      value: stats ? formatBytes(stats.totalBytes) : '—',
      icon: Activity,
      accent: 'text-cyan-400',
      ring: 'border-cyan-500/20',
      glow: 'shadow-[0_0_24px_-8px_rgba(34,211,238,0.4)]',
      sub: stats ? `${formatRate(stats.bytesLastSecond)} now` : 'no data',
    },
    {
      label: 'Packet Rate',
      value: stats ? `${stats.packetsLastSecond} p/s` : '—',
      icon: Gauge,
      accent: 'text-amber-400',
      ring: 'border-amber-500/20',
      glow: 'shadow-[0_0_24px_-8px_rgba(251,191,36,0.4)]',
      sub: stats ? `target ${stats.rate} p/s` : 'no data',
    },
    {
      label: 'Capture Uptime',
      value: stats ? formatUptime(stats.uptime) : '—',
      icon: Clock,
      accent: 'text-teal-400',
      ring: 'border-teal-500/20',
      glow: 'shadow-[0_0_24px_-8px_rgba(45,212,191,0.4)]',
      sub: connected ? 'engine online' : 'engine offline',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`relative overflow-hidden rounded-lg border ${c.ring} bg-zinc-900/60 backdrop-blur p-4 ${c.glow}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                {c.label}
              </p>
              <p className={`mt-1 text-2xl font-mono font-semibold ${c.accent}`}>
                {c.value}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 font-mono">{c.sub}</p>
            </div>
            <c.icon className={`h-5 w-5 ${c.accent} opacity-70`} />
          </div>
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-current opacity-[0.04]" />
        </div>
      ))}
    </div>
  )
}
