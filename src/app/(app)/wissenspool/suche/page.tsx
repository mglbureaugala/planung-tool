'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const THEMEN = [
  { key: '', label: 'Alle Themen' },
  { key: 'BERUFSRECHT', label: 'Berufsrecht & Standesrecht' },
  { key: 'HAFTUNG', label: 'Haftung & Vertragsrecht' },
  { key: 'WIENER_BAUORDNUNG', label: 'Wiener Bauordnung' },
  { key: 'BAURECHT_WIEN', label: 'Baurecht Wien' },
  { key: 'OIB_RICHTLINIEN', label: 'OIB Richtlinien' },
  { key: 'VERGABERECHT', label: 'Vergaberecht & Normenwesen' },
  { key: 'RAUMPLANUNG', label: 'Raumplanung' },
  { key: 'GRUNDBUCHSRECHT', label: 'Grundbuchsrecht' },
  { key: 'VERWALTUNGSRECHT', label: 'Verwaltungsverfahrensrecht' },
  { key: 'BWL', label: 'BWL & Büroorganisation' },
  { key: 'SOZIALE_ABSICHERUNG', label: 'Soziale Absicherung' },
]

type Result = {
  id: string
  snippet: string
  seite: number | null
  titel: string
  thema: string
  quelle: string | null
  rank: number
}

function SucheInner() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [thema, setThema] = useState(searchParams.get('thema') ?? '')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function search(q: string, t: string) {
    if (q.trim().length < 2) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/wissenspool/search?q=${encodeURIComponent(q)}&thema=${t}`)
      const data = await res.json()
      setResults(data.results ?? [])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') search(query, thema)
  }

  const THEMA_LABEL = Object.fromEntries(THEMEN.map(t => [t.key, t.label]))

  return (
    <div style={{ padding: '2rem', maxWidth: 900 }}>
      <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '1.5rem' }}>
        Wissenspool — Suche
      </h1>

      {/* Suchleiste */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Suchbegriff eingeben…"
          autoFocus
          style={{
            flex: 1, padding: '0.6rem 0.75rem',
            border: '1px solid var(--border-color)', borderRadius: 3,
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '0.9rem', outline: 'none',
            fontFamily: 'var(--font-primary)',
          }}
        />
        <select
          value={thema}
          onChange={e => { setThema(e.target.value); search(query, e.target.value) }}
          style={{
            padding: '0.6rem 0.75rem',
            border: '1px solid var(--border-color)', borderRadius: 3,
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '0.8rem', fontFamily: 'var(--font-primary)',
          }}
        >
          {THEMEN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <button
          onClick={() => search(query, thema)}
          disabled={loading}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'var(--ikb)', color: '#fff',
            border: 'none', borderRadius: 3, cursor: 'pointer',
            fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          {loading ? '…' : 'Suchen'}
        </button>
      </div>

      {/* Ergebnisse */}
      {searched && !loading && results.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Keine Treffer für „{query}".
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {results.map(r => (
          <div key={r.id} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            padding: '1rem 1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ikb)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {THEMA_LABEL[r.thema] ?? r.thema}
              </span>
              {r.quelle && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.quelle}{r.seite ? `, S. ${r.seite}` : ''}</span>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
              {r.snippet}
            </p>
            <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-light)' }}>
              {r.titel}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuchePage() {
  return (
    <Suspense>
      <SucheInner />
    </Suspense>
  )
}
