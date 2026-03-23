'use client'

import { useState } from 'react'

type Note = { id: string; titel: string | null; inhalt: string; aktualisiertAm: Date | string }

export function NotizenPanel({ thema, initialNotizen }: { thema: string; initialNotizen: Note[] }) {
  const [notizen, setNotizen] = useState<Note[]>(initialNotizen)
  const [neuerTitel, setNeuerTitel] = useState('')
  const [neuerInhalt, setNeuerInhalt] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitel, setEditTitel] = useState('')
  const [editInhalt, setEditInhalt] = useState('')
  const [saving, setSaving] = useState(false)

  async function addNote() {
    if (!neuerInhalt.trim()) return
    setSaving(true)
    const res = await fetch('/api/wissenspool/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thema, titel: neuerTitel || null, inhalt: neuerInhalt }),
    })
    const data = await res.json()
    setNotizen(prev => [data.note, ...prev])
    setNeuerTitel('')
    setNeuerInhalt('')
    setSaving(false)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/wissenspool/notes?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titel: editTitel || null, inhalt: editInhalt }),
    })
    const data = await res.json()
    setNotizen(prev => prev.map(n => n.id === id ? data.note : n))
    setEditId(null)
    setSaving(false)
  }

  async function deleteNote(id: string) {
    await fetch(`/api/wissenspool/notes?id=${id}`, { method: 'DELETE' })
    setNotizen(prev => prev.filter(n => n.id !== id))
  }

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.6rem', boxSizing: 'border-box' as const,
    border: '1px solid var(--border-color)', borderRadius: 3,
    background: 'var(--bg)', color: 'var(--text)',
    fontSize: '0.82rem', fontFamily: 'var(--font-primary)', outline: 'none',
  }

  return (
    <div>
      <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Eigene Notizen
      </div>

      {/* Neue Notiz */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '0.9rem', marginBottom: '1rem' }}>
        <input
          value={neuerTitel}
          onChange={e => setNeuerTitel(e.target.value)}
          placeholder="Titel (optional)"
          style={{ ...inputStyle, marginBottom: '0.4rem' }}
        />
        <textarea
          value={neuerInhalt}
          onChange={e => setNeuerInhalt(e.target.value)}
          placeholder="Notiz eingeben…"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <button
          onClick={addNote}
          disabled={saving || !neuerInhalt.trim()}
          style={{
            marginTop: '0.5rem', padding: '0.4rem 0.9rem',
            background: saving || !neuerInhalt.trim() ? 'var(--border-color)' : 'var(--ikb)',
            color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer',
            fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          {saving ? '…' : 'Notiz hinzufügen'}
        </button>
      </div>

      {/* Bestehende Notizen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {notizen.map(n => (
          <div key={n.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '0.85rem' }}>
            {editId === n.id ? (
              <>
                <input
                  value={editTitel}
                  onChange={e => setEditTitel(e.target.value)}
                  style={{ ...inputStyle, marginBottom: '0.4rem' }}
                />
                <textarea
                  value={editInhalt}
                  onChange={e => setEditInhalt(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <button onClick={() => saveEdit(n.id)} disabled={saving} style={{ padding: '0.3rem 0.7rem', background: 'var(--ikb)', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: '0.72rem' }}>
                    Speichern
                  </button>
                  <button onClick={() => setEditId(null)} style={{ padding: '0.3rem 0.7rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: 3, cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Abbrechen
                  </button>
                </div>
              </>
            ) : (
              <>
                {n.titel && <div style={{ fontWeight: 400, fontSize: '0.82rem', marginBottom: '0.25rem' }}>{n.titel}</div>}
                <p style={{ fontSize: '0.82rem', color: 'var(--text)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{n.inhalt}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setEditId(n.id); setEditTitel(n.titel ?? ''); setEditInhalt(n.inhalt) }} style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Bearbeiten
                  </button>
                  <button onClick={() => deleteNote(n.id)} style={{ fontSize: '0.68rem', color: '#B83220', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Löschen
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {notizen.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Noch keine Notizen zu diesem Thema.</p>
        )}
      </div>
    </div>
  )
}
