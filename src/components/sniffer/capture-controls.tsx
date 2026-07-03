'use client'

import { Play, Square, Trash2, Search, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { PacketFilters, ProtocolFilter } from '@/lib/packet-types'

interface Props {
  connected: boolean
  capturing: boolean
  rate: number
  filters: PacketFilters
  onStart: () => void
  onStop: () => void
  onClear: () => void
  onSetRate: (r: number) => void
  onSetProtocol: (p: ProtocolFilter) => void
  onSetApp: (a: string) => void
  onSetSearch: (s: string) => void
}

const PROTOCOLS: { value: ProtocolFilter; label: string }[] = [
  { value: 'ALL', label: 'All Protocols' },
  { value: 'TCP', label: 'TCP' },
  { value: 'UDP', label: 'UDP' },
  { value: 'ICMP', label: 'ICMP' },
]

const APPS = ['ALL', 'TLS', 'HTTP', 'DNS', 'SSH', 'NTP', 'mDNS', 'DHCP', 'ICMP']

export function CaptureControls({
  connected,
  capturing,
  rate,
  filters,
  onStart,
  onStop,
  onClear,
  onSetRate,
  onSetProtocol,
  onSetApp,
  onSetSearch,
}: Props) {
  const rates = [8, 18, 35, 60, 100, 180]

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur p-3 flex flex-wrap items-center gap-2">
      {/* status pill */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-mono font-medium border',
          connected
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-400',
        )}
      >
        {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {connected ? (capturing ? 'CAPTURING' : 'PAUSED') : 'OFFLINE'}
        {capturing && connected && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        )}
      </div>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      {/* capture controls */}
      <Button
        size="sm"
        onClick={onStart}
        disabled={!connected || capturing}
        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 h-8"
      >
        <Play className="h-3.5 w-3.5" /> Start
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onStop}
        disabled={!capturing}
        className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 gap-1.5 h-8"
      >
        <Square className="h-3.5 w-3.5" /> Stop
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onClear}
        className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 gap-1.5 h-8"
      >
        <Trash2 className="h-3.5 w-3.5" /> Clear
      </Button>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      {/* rate selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
          Rate
        </span>
        <div className="flex items-center gap-1">
          {rates.map((r) => (
            <button
              key={r}
              onClick={() => onSetRate(r)}
              disabled={!connected}
              className={cn(
                'rounded px-2 py-1 text-[11px] font-mono transition-colors',
                rate === r
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-700',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-600 font-mono">pps</span>
      </div>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      {/* filters */}
      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
        <Select value={filters.protocol} onValueChange={(v) => onSetProtocol(v as ProtocolFilter)}>
          <SelectTrigger className="w-[130px] h-8 bg-zinc-950 border-zinc-800 text-zinc-200 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            {PROTOCOLS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-zinc-200 text-xs font-mono">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.app} onValueChange={onSetApp}>
          <SelectTrigger className="w-[110px] h-8 bg-zinc-950 border-zinc-800 text-zinc-200 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            {APPS.map((a) => (
              <SelectItem key={a} value={a} className="text-zinc-200 text-xs font-mono">
                {a === 'ALL' ? 'All Apps' : a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
          <Input
            value={filters.search}
            onChange={(e) => onSetSearch(e.target.value)}
            placeholder="filter by IP, port, host…"
            className="pl-8 h-8 bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  )
}
