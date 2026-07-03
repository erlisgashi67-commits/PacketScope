'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { shortIp } from '@/lib/packet-utils'
import type { CaptureStats } from '@/lib/packet-types'

interface Props {
  stats: CaptureStats | null
}

export function TopTalkers({ stats }: Props) {
  const srcEntries = stats
    ? Object.entries(stats.srcIps).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : []
  const dstEntries = stats
    ? Object.entries(stats.dstIps).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : []
  const maxSrc = srcEntries[0]?.[1] || 1
  const maxDst = dstEntries[0]?.[1] || 1

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur p-3 h-full flex flex-col">
      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">
        Top Talkers
      </h3>
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              Sources
            </span>
          </div>
          <div className="space-y-1.5">
            {srcEntries.length === 0 ? (
              <p className="text-zinc-700 text-[11px] font-mono">no data</p>
            ) : (
              srcEntries.map(([ip, count]) => (
                <div key={ip}>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                    <span className="text-zinc-300 truncate">{shortIp(ip)}</span>
                    <span className="text-zinc-500">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      style={{ width: `${(count / maxSrc) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowDownLeft className="h-3 w-3 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              Destinations
            </span>
          </div>
          <div className="space-y-1.5">
            {dstEntries.length === 0 ? (
              <p className="text-zinc-700 text-[11px] font-mono">no data</p>
            ) : (
              dstEntries.map(([ip, count]) => (
                <div key={ip}>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                    <span className="text-zinc-300 truncate">{shortIp(ip)}</span>
                    <span className="text-zinc-500">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                      style={{ width: `${(count / maxDst) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
