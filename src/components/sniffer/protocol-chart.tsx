'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { protocolColor } from '@/lib/packet-utils'
import type { CaptureStats } from '@/lib/packet-types'

interface Props {
  stats: CaptureStats | null
}

export function ProtocolChart({ stats }: Props) {
  const data = stats
    ? Object.entries({ ...stats.perProtocol, ...stats.perApp })
        .filter(([k]) => k !== '—')
        .reduce((acc, [k, v]) => {
          const existing = acc.find((x) => x.name === k)
          if (existing) existing.value += v
          else acc.push({ name: k, value: v as number })
          return acc
        }, [] as { name: string; value: number }[])
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : []

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur p-3 h-full flex flex-col">
      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
        Protocol Distribution
      </h3>
      <div className="flex-1 min-h-[140px] relative">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 text-xs font-mono">
            no data
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="#09090b"
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={protocolColor(d.name).hex} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v: number) => [`${v} pkts`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-mono font-bold text-zinc-200">{total}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">packets</span>
            </div>
          </>
        )}
      </div>
      {data.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
          {data.map((d) => {
            const c = protocolColor(d.name)
            return (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="text-zinc-400">{d.name}</span>
                <span className="text-zinc-600 ml-auto">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
