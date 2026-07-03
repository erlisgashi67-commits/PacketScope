'use client'

import { cn } from '@/lib/utils'
import { protocolColor, tcpFlagColor, formatTime } from '@/lib/packet-utils'
import type { ParsedPacket } from '@/lib/packet-types'

interface Props {
  packet: ParsedPacket | null
}

export function PacketDetail({ packet }: Props) {
  if (!packet) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center text-zinc-600 text-xs p-6 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-zinc-800 flex items-center justify-center mb-3">
          <span className="text-zinc-700 text-lg">+</span>
        </div>
        <p className="font-mono">Select a packet to inspect its decoded fields and raw bytes</p>
      </div>
    )
  }

  const proto = packet.transport?.protocol || packet.ip?.protocol || '—'
  const app = packet.application?.protocol
  const colors = protocolColor(app || proto)

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* header */}
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-[11px] font-mono">PACKET</span>
          <span className="text-emerald-400 text-sm font-mono font-bold">#{packet.id}</span>
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
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">
          {formatTime(packet.timestamp)} · {packet.length} bytes
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto sniffer-scroll">
        {/* decoded tree */}
        <Section title="Ethernet II" color="text-zinc-400">
          <Field label="Destination" value={packet.eth.dstMac} />
          <Field label="Source" value={packet.eth.srcMac} />
          <Field label="Type" value={packet.eth.etherType} />
        </Section>

        {packet.ip && (
          <Section title={`Internet Protocol v${packet.ip.version}`} color="text-cyan-400">
            <Field label="Version" value={`${packet.ip.version}`} />
            <Field label="Header Length" value={`${packet.ip.headerLength} bytes`} />
            <Field label="Total Length" value={`${packet.ip.totalLength} bytes`} />
            <Field label="Identification" value={`0x${packet.ip.identification.toString(16).padStart(4, '0')} (${packet.ip.identification})`} />
            <Field label="Flags" value={packet.ip.flags} />
            <Field label="TTL" value={`${packet.ip.ttl}`} />
            <Field label="Protocol" value={`${packet.ip.protocol} (${packet.ip.protocolNumber})`} />
            <Field label="Source" value={packet.ip.srcIp} mono highlight />
            <Field label="Destination" value={packet.ip.dstIp} mono highlight />
          </Section>
        )}

        {packet.transport && (
          <Section
            title={`${packet.transport.protocol} ${packet.transport.protocol === 'ICMP' ? '' : `${packet.transport.srcPort} → ${packet.transport.dstPort}`}`.trim()}
            color="text-emerald-400"
          >
            {packet.transport.protocol === 'TCP' && (
              <>
                <Field label="Source Port" value={`${packet.transport.srcPort}`} />
                <Field label="Destination Port" value={`${packet.transport.dstPort}`} />
                <Field label="Sequence" value={`${packet.transport.seq}`} />
                <Field label="Acknowledgment" value={`${packet.transport.ack}`} />
                <Field
                  label="Flags"
                  value={
                    <div className="flex flex-wrap gap-1">
                      {(packet.transport.flags || []).map((f) => (
                        <span
                          key={f}
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] border font-bold font-mono',
                            tcpFlagColor(f),
                          )}
                        >
                          {f}
                        </span>
                      ))}
                      {(!packet.transport.flags || packet.transport.flags.length === 0) && (
                        <span className="text-zinc-600 text-[11px]">none</span>
                      )}
                    </div>
                  }
                />
                <Field label="Window" value={`${packet.transport.window}`} />
              </>
            )}
            {packet.transport.protocol === 'UDP' && (
              <>
                <Field label="Source Port" value={`${packet.transport.srcPort}`} />
                <Field label="Destination Port" value={`${packet.transport.dstPort}`} />
                <Field label="Length" value={`${packet.transport.length}`} />
              </>
            )}
            {packet.transport.protocol === 'ICMP' && (
              <>
                <Field label="Type" value={packet.transport.icmpType || '—'} />
                <Field label="Code" value={`${packet.transport.icmpCode ?? 0}`} />
              </>
            )}
          </Section>
        )}

        {packet.application && (
          <Section title={`Application — ${packet.application.protocol}`} color="text-amber-400">
            <Field label="Info" value={packet.application.info} mono />
            {packet.application.details &&
              Object.entries(packet.application.details).map(([k, v]) => (
                <Field key={k} label={k} value={String(v)} mono />
              ))}
          </Section>
        )}

        {/* raw hex dump */}
        <div className="border-t border-zinc-800">
          <div className="px-3 py-1.5 bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
            <span>Hex Dump (raw bytes)</span>
            <span className="text-zinc-600 normal-case tracking-normal">{packet.rawLength} bytes</span>
          </div>
          <pre className="px-3 py-2 text-[10.5px] leading-[1.5] font-mono text-zinc-300 overflow-x-auto whitespace-pre">
            {colorizeHex(packet.hex)}
          </pre>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  color,
  children,
}: {
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-zinc-800">
      <div className="px-3 py-1.5 bg-zinc-900/40">
        <span className={cn('text-[11px] font-semibold font-mono', color)}>▸ {title}</span>
      </div>
      <div className="px-3 py-1.5 space-y-0.5">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
  highlight,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-baseline gap-3 text-[11px]">
      <span className="text-zinc-600 w-32 flex-shrink-0">{label}:</span>
      <span
        className={cn(
          mono ? 'font-mono' : '',
          highlight ? 'text-emerald-300 font-mono' : 'text-zinc-300',
        )}
      >
        {value}
      </span>
    </div>
  )
}

// Lightly tint the hex dump: offsets dim, ASCII column brighter.
function colorizeHex(hex: string): React.ReactNode {
  return hex.split('\n').map((line, i) => {
    const offMatch = line.match(/^([0-9a-f]+)  /)
    if (!offMatch) {
      return (
        <div key={i} className="text-zinc-600">
          {line}
        </div>
      )
    }
    const offset = offMatch[1]
    const rest = line.slice(offMatch[0].length)
    const pipeIdx = rest.indexOf('|')
    const hexPart = pipeIdx >= 0 ? rest.slice(0, pipeIdx) : rest
    const asciiPart = pipeIdx >= 0 ? rest.slice(pipeIdx) : ''
    return (
      <div key={i}>
        <span className="text-zinc-600">{offset}  </span>
        <span className="text-emerald-400/80">{hexPart}</span>
        <span className="text-zinc-500">{asciiPart}</span>
      </div>
    )
  })
}
