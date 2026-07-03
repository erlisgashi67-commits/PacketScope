import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PacketScope — Network Packet Sniffer & Traffic Analyzer",
  description: "A real-time network packet sniffer that assembles and dissects real binary Ethernet/IPv4/TCP/UDP/ICMP frames byte-by-byte, with a live SOC-style traffic dashboard.",
  keywords: ["packet sniffer", "network analyzer", "TCP", "UDP", "ICMP", "DNS", "traffic analysis", "hex dump"],
  authors: [{ name: "PacketScope" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PacketScope — Network Packet Sniffer",
    description: "Real-time binary protocol dissection with a live traffic dashboard",
    siteName: "PacketScope",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PacketScope — Network Packet Sniffer",
    description: "Real-time binary protocol dissection with a live traffic dashboard",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
