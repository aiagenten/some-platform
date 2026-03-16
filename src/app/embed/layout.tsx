import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'SoMe Widget',
  description: 'Embedded SoMe widget',
}

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // No nav/sidebar — bare minimum for embed
  return (
    <html lang="no">
      <body className="bg-transparent m-0 p-0">{children}</body>
    </html>
  )
}
