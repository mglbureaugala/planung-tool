'use client'

import { useState, useRef, useEffect } from 'react'

type Msg = { rolle: 'user' | 'assistant'; text: string }

const BEISPIELE = [
  'Mindestbreite barrierefreier WC-Raum nach ÖNORM B 1600?',
  'Steigungsverhältnis Treppe nach Neufert?',
  'Wie groß muss ein PKW-Stellplatz sein?',
  'Mindestraumhöhe Wohnraum Wien?',
  'Tageslichtquotient Aufenthaltsraum?',
  'Abstandsflächen Wiener Bauordnung §79?',
  'GFZ Wiener Wohngebiet typisch?',
  'Erschließungsbreite Tiefgarage?',
]

export default function ChatPage() {
  const [verlauf, setVerlauf] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [verlauf])

  async function send(frage?: string) {
    const q = frage ?? input.trim()
    if (!q || loading) return
    setInput('')
    const newVerlauf: Msg[] = [...verlauf, { rolle: 'user', text: q }]
    setVerlauf(newVerlauf)
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frage: q, verlauf }),
    })

    let answer = ''
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    setVerlauf([...newVerlauf, { rolle: 'assistant', text: '' }])

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      answer += decoder.decode(value)
      setVerlauf([...newVerlauf, { rolle: 'assistant', text: answer }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--surface)' }}>
        <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)' }}>
          Entwurfsparameter
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Neufert · OIB · Wiener Bauordnung · ÖNORM
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {verlauf.length === 0 && (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Stell eine Frage zu Planungsparametern, Maßen, Normen oder Entwurfsregeln.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {BEISPIELE.map(b => (
                <button key={b} onClick={() => send(b)} style={{
                  padding: '0.4rem 0.75rem',
                  background: 'var(--surface)', border: '1px solid var(--border-color)',
                  borderRadius: 3, fontSize: '0.78rem', color: 'var(--text)',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {verlauf.map((m, i) => (
          <div key={i} style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: m.rolle === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '75%',
              padding: '0.75rem 1rem',
              borderRadius: 3,
              background: m.rolle === 'user' ? 'var(--ikb)' : 'var(--surface)',
              color: m.rolle === 'user' ? '#fff' : 'var(--text)',
              border: m.rolle === 'assistant' ? '1px solid var(--border-color)' : 'none',
              fontSize: '0.88rem',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
            }}>
              {m.text || (loading && i === verlauf.length - 1 ? '…' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '1rem 2rem', borderTop: '1px solid var(--border-color)', background: 'var(--surface)', display: 'flex', gap: '0.75rem' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Frage zu Normen, Maßen, Planungsparametern…"
          style={{
            flex: 1, padding: '0.6rem 0.9rem',
            border: '1px solid var(--border-color)', borderRadius: 3,
            background: 'var(--bg)', color: 'var(--text)',
            fontSize: '0.88rem', outline: 'none',
          }}
          autoFocus
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          padding: '0.6rem 1.25rem',
          background: 'var(--ikb)', color: '#fff',
          border: 'none', borderRadius: 3,
          fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {loading ? '…' : 'Senden'}
        </button>
        {verlauf.length > 0 && (
          <button onClick={() => setVerlauf([])} style={{
            padding: '0.6rem 0.9rem',
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border-color)', borderRadius: 3,
            fontSize: '0.78rem',
          }}>
            Neu
          </button>
        )}
      </div>
    </div>
  )
}
