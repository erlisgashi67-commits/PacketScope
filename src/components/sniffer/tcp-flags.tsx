'use client'

import { cn } from '@/lib/utils'
import { tcpFlagColor } from '@/lib/packet-utils'
import type { CaptureStats } from '@/lib/packet-types'

interface Props {
  stats: CaptureStats | null
}

const FLAG_ORDER = ['SYN', 'ACK', 'PSH', 'FIN', 'RST', 'URG', 'ECE', 'CWR']

const FLAG_DESC: Record<string, string> = {
  SYN: 'Synchronize — initiates a connection',
  ACK: 'Acknowledgment — confirms receipt',
  PSH: 'Push — deliver data immediately',
  FIN: 'Finish — gracefully close connection',
  RST: 'Reset — abort connection',
  URG: 'Urgent — priority data',
  ECE: 'ECN Echo — congestion notification',
  CWR: 'Congestion Window Reduced',
}

export function TcpFlags({ stats }: Props) {
  const flags = stats?.tcpFlags || {}
  const present = FLAG_ORDER.filter((f) => flags[f])
  const total = present.reduce((s, f) => s + flags[f], 0) || 1

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur p-3 h-full flex flex-col">
      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">
        TCP Flag Analysis
      </h3>
      <div className="space-y-2 flex-1">
        {present.length === 0 ? (
          <p className="text-zinc-700 text-[11px] font-mono">no TCP traffic yet</p>
        ) : (
          present.map((f) => {
            const count = flags[f]
            const pct = (count / total) * 100
            return (
              <div key={f} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border font-mono',
                      tcpFlagColor(f),
                    )}
                  >
                    {f}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {count} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-zinc-500 to-zinc-300 group-hover:from-zinc-400 group-hover:to-zinc-200 transition-colors"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
      {present.length > 0 && (
        <p className="mt-2 pt-2 border-t border-zinc-800 text-[9px] text-zinc-600 font-mono leading-relaxed">
          {FLAG_DESC[present[0]]}
        </p>
      )}
    </div>
  )
}
