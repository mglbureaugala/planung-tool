import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'bureau gala – Planungstool',
  description: 'Architektur-Planungswerkzeug',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  )
}
