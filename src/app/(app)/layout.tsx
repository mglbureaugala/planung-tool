'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/raumprogramm', label: 'Raumprogramm' },
  { href: '/chat', label: 'Entwurfsparameter' },
  { href: '/grundstueck', label: 'Grundstück-Check' },
  { href: '/projekte', label: 'Projekte' },
  { href: '/wissenspool', label: 'Wissenspool' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220,
        minWidth: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
      }}>
        {/* Logo */}
        <div style={{
          padding: '1.5rem 1.25rem 1rem',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            bureau gala
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--ikb)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 400 }}>
            Planungstool
          </div>
        </div>

        {/* Navigation */}
        <div style={{ padding: '0.75rem 0', flex: 1 }}>
          {NAV.map(item => {
            const active = path.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'block',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: active ? 'var(--ikb)' : 'var(--text-muted)',
                  background: active ? 'var(--ikb-light)' : 'transparent',
                  borderLeft: active ? '2px solid var(--ikb)' : '2px solid transparent',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.65rem', color: 'var(--text-light)' }}>
          planung.bureau-gala.at
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
