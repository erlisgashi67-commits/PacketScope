// Helpers for protocol colors, byte formatting, and time formatting.

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatRate(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function shortIp(ip: string): string {
  // keep private IPs fully, shorten public IPs to last two octets
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return ip
  const parts = ip.split('.')
  return `…${parts[2]}.${parts[3]}`
}

// Protocol color palette — emerald/amber/rose/cyan/teal/yellow/orange (no indigo/blue)
export function protocolColor(proto: string): {
  text: string
  bg: string
  border: string
  dot: string
  hex: string
} {
  const p = proto.toUpperCase()
  switch (p) {
    case 'TCP':
      return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', hex: '#34d399' }
    case 'UDP':
      return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400', hex: '#fbbf24' }
    case 'ICMP':
      return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', dot: 'bg-rose-400', hex: '#fb7185' }
    case 'DNS':
      return { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', dot: 'bg-cyan-400', hex: '#22d3ee' }
    case 'TLS':
    case 'HTTPS':
      return { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', dot: 'bg-teal-400', hex: '#2dd4bf' }
    case 'HTTP':
      return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-400', hex: '#facc15' }
    case 'SSH':
      return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400', hex: '#fb923c' }
    case 'NTP':
      return { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30', dot: 'bg-lime-400', hex: '#a3e635' }
    case 'MDNS':
      return { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', dot: 'bg-fuchsia-400', hex: '#e879f9' }
    case 'DHCP':
      return { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30', dot: 'bg-pink-400', hex: '#f472b6' }
    default:
      return { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', dot: 'bg-zinc-400', hex: '#a1a1aa' }
  }
}

export function tcpFlagColor(flag: string): string {
  switch (flag) {
    case 'SYN':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'ACK':
      return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
    case 'FIN':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    case 'RST':
      return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
    case 'PSH':
      return 'text-teal-400 bg-teal-500/10 border-teal-500/30'
    case 'URG':
      return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    default:
      return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30'
  }
}
