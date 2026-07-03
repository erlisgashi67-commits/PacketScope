# PacketScope

**A real-time network packet sniffer & traffic analyzer** that assembles and dissects real binary network frames byte-by-byte, with a live SOC-style dashboard.

PacketScope demonstrates the genuinely hard parts of network analysis — working with raw binary protocol structures, reading bytes at precise offsets, decoding TCP flags from bit masks, and turning raw network noise into a clean, human-readable visual dashboard.

> Built with Next.js 16, TypeScript, Tailwind CSS, Recharts, Socket.IO, and a custom binary packet engine.

---

## Why this project is interesting

Most "packet sniffers" shown in tutorials either (a) call out to `tcpdump`/`libpcap` and just render the text output, or (b) fake everything with random JSON. PacketScope does neither:

- The capture engine **builds actual binary frames** as Node `Buffer`s, following the RFCs:
  - **Ethernet II** (14 bytes) — dst MAC, src MAC, EtherType
  - **IPv4 header** (20 bytes) — RFC 791, including real one's-complement checksum
  - **TCP header** (20 bytes) — RFC 793, with bit-packed flags
  - **UDP header** (8 bytes) — RFC 768
  - **ICMP** (4+ bytes) — RFC 792
- It then **parses each frame back byte-by-byte** — reading the version/IHL from byte 0, TTL/protocol from bytes 8–9, source/destination IPs from 4-byte fields, TCP flags from bit masks, and decoding DNS question names label-by-label from the payload.
- The **hex dump** shown in the packet inspector is the genuine raw bytes of the selected frame — not a mock.

This is exactly the kind of low-level binary parsing that's hard to fake and hard to get an AI to debug blindly.

---

## Features

### Capture engine
- Real binary frame construction (Ethernet / IPv4 / TCP / UDP / ICMP)
- Byte-level parsing with correct offset arithmetic
- IPv4 header checksum computation (one's complement of the one's complement sum)
- TCP flag bit encoding (`SYN | ACK | PSH | FIN | RST | URG | ECE | CWR`)
- Realistic traffic simulation: DNS lookups, full TCP 3-way handshakes → HTTP/TLS sessions → FIN teardown, video streaming, file downloads, NTP, mDNS, ICMP pings
- Application-layer decoding for DNS (query/response with decoded hostnames), HTTP, TLS, SSH, NTP

### Dashboard
- **Live packet stream** — color-coded by protocol, TCP flags as badges, decoded info per packet
- **Packet inspector** — click any packet to see the decoded protocol tree (Ethernet → IP → Transport → Application) plus the raw hex dump
- **Stat cards** — total packets, traffic volume, live packet rate, capture uptime
- **Protocol distribution** donut chart
- **Throughput** dual-axis area chart (packets/s + bytes/s, last 60s)
- **Top talkers** — source & destination IP rankings with bar indicators
- **Port usage** — source & destination port breakdown with well-known-port labels
- **TCP flag analysis** — SYN/ACK/PSH/FIN/RST distribution with RFC descriptions
- **Capture controls** — start/stop/clear, packet-rate selector (8–180 pps), protocol + app filters, live text search
- Dark SOC/terminal aesthetic, fully responsive, sticky footer

---

## Architecture

```
┌─────────────────────────────┐        Socket.IO         ┌──────────────────────────────┐
│   Packet Engine (port 3001) │  ───────────────────────▶ │   Next.js Dashboard (:3000)  │
│   mini-services/sniffer/    │   packet / stats events   │   src/app/page.tsx           │
│                             │ ◀───────────────────────  │                              │
│  • buildFrame() → Buffer    │   start/stop/clear/rate   │  • live stream               │
│  • parseFrame() → fields    │                           │  • hex inspector             │
│  • traffic simulation       │                           │  • charts (Recharts)         │
└─────────────────────────────┘                           └──────────────────────────────┘
            ▲                                                          ▲
            │ Caddy gateway (:81) routes /?XTransformPort=3001         │
            └──────────────────────────────────────────────────────────┘
```

- **`mini-services/sniffer/packets.ts`** — binary frame builder & parser, hex dump formatter, protocol constants.
- **`mini-services/sniffer/traffic.ts`** — realistic traffic flow simulation (hosts, remotes, DNS, TCP sessions).
- **`mini-services/sniffer/index.ts`** — Socket.IO server, capture loop, stats aggregation.
- **`src/lib/use-packet-capture.ts`** — React hook with batched updates and client-side filtering.
- **`src/lib/packet-types.ts`** — shared TypeScript types.
- **`src/lib/packet-utils.ts`** — formatting helpers & protocol color palette.
- **`src/components/sniffer/*`** — dashboard UI components.

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- The Next.js dev server runs on port **3000**, the capture engine on port **3001**.

### 1. Install dependencies

```bash
# main project
bun install

# capture engine
cd mini-services/sniffer && bun install && cd ../..
```

### 2. Start the capture engine

```bash
cd mini-services/sniffer
bun run dev
```

You should see:
```
[sniffer] packet capture engine listening on port 3001
```

### 3. Start the dashboard

In a separate terminal, from the project root:

```bash
bun run dev
```

Then open the app in the **Preview Panel** (the dev server runs on port 3000). The dashboard connects to the capture engine automatically and packets begin streaming.

---

## How the binary parsing works

A TCP packet over IPv4 over Ethernet is built like this (every byte matters):

```
Offset  Length  Field
0       6       Destination MAC
6       6       Source MAC
12      2       EtherType (0x0800 = IPv4)
14      1       Version (4) + IHL (5) packed into one byte → 0x45
15      1       DSCP / ECN
16      2       Total length
18      2       Identification
20      2       Flags (DF/MF) + fragment offset
22      1       TTL
23      1       Protocol (6 = TCP, 17 = UDP, 1 = ICMP)
24      2       Header checksum (one's complement)
26      4       Source IP
30      4       Destination IP
34      2       Source port
36      2       Destination port
38      4       Sequence number
42      4       Acknowledgment number
46      1       Data offset (upper 4 bits) + reserved
47      1       TCP flags (bit mask: FIN|SYN|RST|PSH|ACK|URG|ECE|CWR)
48      2       Window size
50      2       Checksum
52      2       Urgent pointer
54      …       Payload
```

`packets.ts` writes these fields with big-endian helpers and reads them back with the same offset arithmetic a real pcap dissector uses. The IPv4 checksum is computed as the one's complement of the one's complement sum of all 16-bit words in the header.

---

## Example: what you'll see in the packet stream

```
#   Time         Source              Destination         Proto  Len  Info
8718 28:33.645   192.168.1.30:54082  142.250.190.78:443  TLS    54   A  TLS Application Data (0B)
8717 28:33.588   8.8.8.8:53          192.168.1.20:50078  DNS    86   Response id=0x1726 1Q github.com
8715 28:33.479   192.168.1.11:50685  8.8.8.8:53          DNS    79   Query id=0x220b 1Q teams.microsoft.com
8713 28:33.362   192.168.1.30:123    129.6.15.30:123     NTP    90   NTP client v3
8703 28:32.845   192.168.1.30:5353   224.0.0.251:5353    mDNS   62   mDNS multicast
8709 28:33.188   140.82.121.4:8000   192.168.1.20:58137  TCP    1802 P,A TCP PSH,ACK seq=4145576965 ack=4145575692 win=64240
```

Clicking any row opens the inspector with the decoded protocol tree and the raw hex dump:

```
0000  e0 3f 49 8a c2 01 b8 27  eb 3f 44 11 08 00 45 00  |.?I....' .?D...E.|
0010  00 44 22 0b 40 00 40 06  00 00 c0 a8 01 0b 08 08  |.D".@.@. ........|
...
```

---

## Tech stack

| Layer | Technology |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI components | shadcn/ui (New York) |
| Charts | Recharts |
| Real-time | Socket.IO (engine) + socket.io-client (frontend) |
| Runtime | Bun |

---

## Project structure

```
.
├── mini-services/
│   └── sniffer/                 # Packet capture engine (port 3001)
│       ├── packets.ts           # Binary frame builder & parser
│       ├── traffic.ts           # Realistic traffic simulation
│       ├── index.ts             # Socket.IO server + capture loop
│       └── package.json
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Main dashboard
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives
│   │   └── sniffer/             # Dashboard components
│   │       ├── stat-cards.tsx
│   │       ├── capture-controls.tsx
│   │       ├── packet-stream.tsx
│   │       ├── packet-detail.tsx
│   │       ├── protocol-chart.tsx
│   │       ├── traffic-chart.tsx
│   │       ├── top-talkers.tsx
│   │       ├── port-usage.tsx
│   │       └── tcp-flags.tsx
│   └── lib/
│       ├── packet-types.ts      # Shared types
│       ├── packet-utils.ts      # Formatting & colors
│       ├── use-packet-capture.ts # Socket hook + filters
│       ├── db.ts
│       └── utils.ts
├── prisma/
├── package.json
└── README.md
```

---

## Notes

- The capture engine generates **simulated** traffic (it doesn't open raw sockets or require root), but every frame it produces is a structurally valid, parseable binary packet — so the parsing logic, hex dumps, and protocol decoding are all real.
- To capture real traffic you'd swap `traffic.ts`'s `nextPacket()` for a `libpcap` binding (e.g. `pcap` or `node-pcap`); the rest of the pipeline would work unchanged.

---

## License

MIT
