import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ClipForge — Viral Clip Extractor',
  description: 'Paste a YouTube URL. Get a viral short-form clip. AI-powered in seconds.',
  keywords: ['youtube shorts', 'clip extractor', 'viral clips', 'AI video', 'short form'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="noise" suppressHydrationWarning>{children}</body>
    </html>
  )
}
