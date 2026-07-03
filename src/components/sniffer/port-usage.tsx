'use client'

import { cn } from '@/lib/utils'

interface Props {
  ports: Record<string, number>
  title: string
  accent: 'emerald' | 'amber'
}

const WELL_KNOWN_PORTS: Record<string, string> = {
  '20': 'FTP-DATA',
  '21': 'FTP',
  '22': 'SSH',
  '23': 'Telnet',
  '25': 'SMTP',
  '53': 'DNS',
  '80': 'HTTP',
  '110': 'POP3',
  '123': 'NTP',
  '143': 'IMAP',
  '161': 'SNMP',
  '443': 'HTTPS',
  '5353': 'mDNS',
  '8080': 'HTTP-ALT',
  '8443': 'HTTPS-ALT',
}

export function PortUsage({ ports, title, accent }: Props) {
  // Filter ephemeral ports (>49151) into a single bucket to keep it readable
  const entries = Object.entries(ports)
  const aggregated: { port: string; count: number; ephemeral?: boolean }[] = []
  let ephemeralTotal = 0
  for (const [port, count] of entries) {
    const n = Number(port)
    if (n >= 49152) {
      ephemeralTotal += count
    } else {
      aggregated.push({ port, count })
    }
  }
  aggregated.sort((a, b) => b.count - a.count)
  if (ephemeralTotal > 0) {
    aggregated.push({ port: 'ephemeral', count: ephemeralTotal, ephemeral: true })
  }
  const top = aggregated.slice(0, 7)
  const max = top[0]?.count || 1

  const barColor =
    accent === 'emerald'
      ? 'from-emerald-500 to-emerald-400'
      : 'from-amber-500 to-amber-400'
  const textColor = accent === 'emerald' ? 'text-emerald-400' : 'text-amber-400'

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur p-3 h-full flex flex-col">
      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">
        {title}
      </h3>
      <div className="space-y-1.5 flex-1">
        {top.length === 0 ? (
          <p className="text-zinc-700 text-[11px] font-mono">no data</p>
        ) : (
          top.map(({ port, count, ephemeral }) => (
            <div key={port} className="flex items-center gap-2">
              <span
                className={cn(
                  'font-mono text-[11px] w-14 flex-shrink-0',
                  ephemeral ? 'text-zinc-500' : textColor,
                )}
              >
                {ephemeral ? '>49152' : port}
              </span>
              <div className="flex-1 h-4 rounded bg-zinc-800 overflow-hidden relative">
                <div
                  className={cn('h-full rounded bg-gradient-to-r', barColor)}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-zinc-500 w-10 text-right">
                {count}
              </span>
              {!ephemeral && WELL_KNOWN_PORTS[port] && (
                <span className="font-mono text-[9px] text-zinc-600 w-16 truncate hidden lg:inline">
                  {WELL_KNOWN_PORTS[port]}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
