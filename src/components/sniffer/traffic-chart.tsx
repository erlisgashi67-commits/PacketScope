'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatBytes } from '@/lib/packet-utils'
import type { TrafficSample } from '@/lib/use-packet-capture'

interface Props {
  data: TrafficSample[]
}

export function TrafficChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: new Date(d.t).toLocaleTimeString('en-US', { hour12: false }).slice(3),
    pps: d.pps,
    bps: d.bps,
  }))

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
          Throughput (last 60s)
        </h3>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-500">pkts/s</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-zinc-500">bytes/s</span>
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-[140px]">
        {chartData.length < 2 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 text-xs font-mono">
            collecting…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="ppsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bpsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#52525b"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                yAxisId="left"
                stroke="#52525b"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#52525b"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(v) => formatBytes(v)}
              />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v: number, name: string) =>
                  name === 'bps' ? [formatBytes(v) + '/s', 'bytes/s'] : [`${v} p/s`, 'packets/s']
                }
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="pps"
                stroke="#34d399"
                strokeWidth={1.5}
                fill="url(#ppsGrad)"
                isAnimationActive={false}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="bps"
                stroke="#22d3ee"
                strokeWidth={1.5}
                fill="url(#bpsGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
