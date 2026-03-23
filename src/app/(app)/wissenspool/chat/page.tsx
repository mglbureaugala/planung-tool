'use client'

import { useState, useRef, useEffect } from 'react'

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

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thema, setThema] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const frage = input.trim()
    if (!frage || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: frage }])
    setLoading(true)

    // Leere Assistenten-Nachricht für Streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/wissenspool/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frage, thema }),
      })

      if (!res.body) throw new Error('Kein Stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `Fehler: ${e}` }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        padding: '1.25rem 2rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '1rem',
        background: 'var(--surface)',
      }}>
        <h1 className="section-title" style={{ fontSize: '1rem', color: 'var(--ikb)', margin: 0 }}>
          ZT Chat-Assistent
        </h1>
        <select
          value={thema}
          onChange={e => setThema(e.target.value)}
          style={{
            marginLeft: 'auto',
            padding: '0.35rem 0.6rem',
            border: '1px solid var(--border-color)', borderRadius: 3,
            background: 'var(--bg)', color: 'var(--text)',
            fontSize: '0.75rem', fontFamily: 'var(--font-primary)',
          }}
        >
          {THEMEN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{
              padding: '0.35rem 0.75rem', fontSize: '0.72rem',
              background: 'none', border: '1px solid var(--border-color)',
              borderRadius: 3, cursor: 'pointer', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            Neu
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '3rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              Stelle eine Frage zu deinem ZT-Wissen.<br />
              Der Assistent sucht in deinen Unterlagen und antwortet mit Quellenangaben.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
              {[
                'Was sind die Voraussetzungen für die Befugnisverleihung?',
                'Wie berechnet sich die bauliche Ausnützbarkeit?',
                'Was regelt § 69 WBO?',
                'Welche OIB-Richtlinien gelten für Brandschutz?',
                'Was ist der Unterschied zwischen GFZ und GRZ?',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus() }}
                  style={{
                    padding: '0.4rem 0.75rem', fontSize: '0.75rem',
                    background: 'var(--surface)', border: '1px solid var(--border-color)',
                    borderRadius: 3, cursor: 'pointer', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%',
              padding: '0.75rem 1rem',
              borderRadius: 3,
              background: m.role === 'user' ? 'var(--ikb)' : 'var(--surface)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              border: m.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
              fontSize: '0.87rem',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content || (m.role === 'assistant' && loading ? <span style={{ color: 'var(--text-light)' }}>…</span> : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '1rem 2rem',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--surface)',
        display: 'flex', gap: '0.5rem',
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Frage eingeben… (Enter zum Senden, Shift+Enter für Zeilenumbruch)"
          rows={2}
          style={{
            flex: 1,
            padding: '0.6rem 0.75rem',
            border: '1px solid var(--border-color)', borderRadius: 3,
            background: 'var(--bg)', color: 'var(--text)',
            fontSize: '0.87rem', outline: 'none', resize: 'none',
            fontFamily: 'var(--font-primary)', lineHeight: 1.5,
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '0 1.2rem',
            background: loading || !input.trim() ? 'var(--border-color)' : 'var(--ikb)',
            color: '#fff', border: 'none', borderRadius: 3, cursor: loading ? 'wait' : 'pointer',
            fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em',
            transition: 'background 0.15s',
          }}
        >
          {loading ? '…' : 'Senden'}
        </button>
      </div>
    </div>
  )
}
