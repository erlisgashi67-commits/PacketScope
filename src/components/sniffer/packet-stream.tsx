'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { protocolColor, tcpFlagColor, formatTime, shortIp } from '@/lib/packet-utils'
import type { ParsedPacket } from '@/lib/packet-types'

interface Props {
  packets: ParsedPacket[]
  selectedId: number | null
  onSelect: (id: number) => void
  autoScroll: boolean
}

export function PacketStream({ packets, selectedId, onSelect, autoScroll }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [packets, autoScroll])

  // newest first for readability
  const ordered = [...packets].reverse()

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="grid grid-cols-[44px_96px_1fr_1fr_72px_70px_2fr] gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold sticky top-0 z-10">
        <span>#</span>
        <span>Time</span>
        <span>Source</span>
        <span>Destination</span>
        <span>Proto</span>
        <span>Len</span>
        <span>Info</span>
      </div>

      {/* rows */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto sniffer-scroll font-mono text-[11px]"
      >
        {ordered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs py-12">
            <div className="text-center">
              <div className="inline-block w-2 h-2 rounded-full bg-zinc-700 animate-pulse mb-2" />
              <p>Waiting for packets…</p>
            </div>
          </div>
        ) : (
          ordered.map((p) => {
            const proto = p.transport?.protocol || p.ip?.protocol || '—'
            const app = p.application?.protocol
            const colors = protocolColor(app || proto)
            const isSelected = p.id === selectedId
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={cn(
                  'w-full text-left grid grid-cols-[44px_96px_1fr_1fr_72px_70px_2fr] gap-2 px-3 py-1.5 border-b border-zinc-900/80 transition-colors',
                  isSelected
                    ? 'bg-emerald-500/15 border-l-2 border-l-emerald-400'
                    : 'hover:bg-zinc-800/50 border-l-2 border-l-transparent',
                )}
              >
                <span className="text-zinc-600 truncate">{p.id}</span>
                <span className="text-zinc-500">{formatTime(p.timestamp).split(' ')[0].slice(3)}</span>
                <span className="text-zinc-300 truncate flex items-center gap-1">
                  <span className="text-zinc-500 hidden sm:inline">{p.ip?.srcIp}</span>
                  <span className="sm:hidden">{p.ip ? shortIp(p.ip.srcIp) : ''}</span>
                  {p.transport?.srcPort ? (
                    <span className="text-zinc-600">:{p.transport.srcPort}</span>
                  ) : null}
                </span>
                <span className="text-zinc-300 truncate flex items-center gap-1">
                  <span className="text-zinc-500 hidden sm:inline">{p.ip?.dstIp}</span>
                  <span className="sm:hidden">{p.ip ? shortIp(p.ip.dstIp) : ''}</span>
                  {p.transport?.dstPort ? (
                    <span className="text-zinc-600">:{p.transport.dstPort}</span>
                  ) : null}
                </span>
                <span>
                  <span
                    className={cn(
                      'inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                      colors.text,
                      colors.bg,
                      colors.border,
                    )}
                  >
                    {app || proto}
                  </span>
                </span>
                <span className="text-zinc-400">{p.length}</span>
                <span className="text-zinc-400 truncate flex items-center gap-1.5">
                  {p.transport?.flags && p.transport.flags.length > 0 && (
                    <span className="flex gap-0.5 flex-shrink-0">
                      {p.transport.flags.slice(0, 3).map((f) => (
                        <span
                          key={f}
                          className={cn(
                            'px-1 rounded text-[9px] border font-bold',
                            tcpFlagColor(f),
                          )}
                        >
                          {f[0]}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="truncate">{p.application?.info || summary(p)}</span>
                </span>
              </button>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function summary(p: ParsedPacket): string {
  if (!p.transport) return p.ip ? `${p.ip.protocol} packet` : 'Frame'
  const t = p.transport
  if (t.protocol === 'ICMP') return t.icmpType ? `ICMP ${t.icmpType}` : 'ICMP'
  if (t.protocol === 'TCP')
    return `TCP ${t.flags?.join(',') || ''} seq=${t.seq ?? 0} ack=${t.ack ?? 0} win=${t.window ?? 0}`
  if (t.protocol === 'UDP') return `UDP len=${t.length ?? 0}`
  return t.protocol
}
