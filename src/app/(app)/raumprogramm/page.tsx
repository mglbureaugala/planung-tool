'use client'

import { useState } from 'react'

const GEBAEUDE_TYPEN = [
  'Mehrfamilienhaus', 'Einfamilienhaus', 'Bürogebäude', 'Hotel',
  'Kindergarten', 'Schule', 'Arztpraxis / Ordination', 'Geschäftshaus',
  'Lager / Gewerbe', 'Pflegeheim', 'Wohnheim', 'Sonstiges',
]

type Raum = {
  bezeichnung: string
  anzahl: number
  flaeche_je: number
  flaeche_gesamt: number
  kategorie: string
  neufert_referenz?: string
  anmerkung?: string
}

type Ergebnis = {
  zusammenfassung: string
  raeume: Raum[]
  flaechenbilanz: {
    hnf: number; nnf: number; vf: number; tf: number
    ngf: number; bgf_faktor: number; bgf_gesamt: number
  }
  empfehlungen: string[]
  neufert_hinweise: string[]
}

export default function RaumprogrammPage() {
  const [gebaeudetyp, setGebaeudetyp] = useState('')
  const [custom, setCustom] = useState('')
  const [notizen, setNotizen] = useState('')
  const [loading, setLoading] = useState(false)
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)

  async function generate() {
    const typ = gebaeudetyp === 'Sonstiges' ? custom : gebaeudetyp
    if (!typ) return
    setLoading(true)
    setErgebnis(null)
    setSaved(false)
    try {
      const res = await fetch('/api/raumprogramm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gebaeudetyp: typ, parameter: notizen ? { hinweise: notizen } : undefined }),
      })
      const data = await res.json()
      setErgebnis(data.ergebnis)
      setName(`${typ} – ${new Date().toLocaleDateString('de-AT')}`)
    } finally {
      setLoading(false)
    }
  }

  async function saveResult() {
    const typ = gebaeudetyp === 'Sonstiges' ? custom : gebaeudetyp
    const res = await fetch('/api/raumprogramm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gebaeudetyp: typ,
        parameter: notizen ? { hinweise: notizen } : undefined,
        name, save: true, ergebnis
      }),
    })
    if (res.ok) setSaved(true)
  }

  const kat = (k: string) => ({ HNF: '#002FA7', NNF: '#5B8DB8', VF: '#8FAF9F', TF: '#B0A090' }[k] ?? '#999')

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>
      <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '0.4rem' }}>
        Raumprogramm-Generator
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.75rem' }}>
        Neufert-basiertes Raumprogramm mit Flächenbilanz — sofort für jede Gebäudekategorie
      </p>

      {/* Eingabe */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
            Gebäudetyp
          </label>
          <select value={gebaeudetyp} onChange={e => setGebaeudetyp(e.target.value)} style={inputStyle}>
            <option value="">— Typ wählen —</option>
            {GEBAEUDE_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {gebaeudetyp === 'Sonstiges' && (
          <div>
            <label style={labelStyle}>Eigene Bezeichnung</label>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="z.B. Coworking-Space" style={inputStyle} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Zusätzliche Parameter / Hinweise (optional)</label>
        <textarea
          value={notizen}
          onChange={e => setNotizen(e.target.value)}
          placeholder="z.B. 12 Wohneinheiten, barrierefreier Zugang, Dachterrasse erwünscht, Budget-Fokus..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <button
        onClick={generate}
        disabled={loading || (!gebaeudetyp || (gebaeudetyp === 'Sonstiges' && !custom))}
        style={btnStyle}
      >
        {loading ? 'Generiere…' : 'Raumprogramm generieren'}
      </button>

      {/* Ergebnis */}
      {ergebnis && (
        <div style={{ marginTop: '2rem' }}>

          {/* Zusammenfassung */}
          <div style={{ background: 'var(--ikb-light)', border: '1px solid var(--ikb)', borderRadius: 3, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--ikb)', lineHeight: 1.6 }}>{ergebnis.zusammenfassung}</p>
          </div>

          {/* Flächenbilanz */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'HNF', val: ergebnis.flaechenbilanz.hnf, color: '#002FA7' },
              { label: 'NNF', val: ergebnis.flaechenbilanz.nnf, color: '#5B8DB8' },
              { label: 'VF', val: ergebnis.flaechenbilanz.vf, color: '#8FAF9F' },
              { label: 'BGF gesamt', val: ergebnis.flaechenbilanz.bgf_gesamt, color: '#1a1a1a' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '0.9rem 1rem' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{item.label}</div>
                <div style={{ fontSize: '1.4rem', color: item.color, fontWeight: 400 }}>{item.val.toLocaleString('de')} m²</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            BGF-Faktor: {ergebnis.flaechenbilanz.bgf_faktor} · NGF: {ergebnis.flaechenbilanz.ngf} m²
          </div>

          {/* Raumtabelle */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg)' }}>
                  {['Bezeichnung', 'Anz.', 'je m²', 'Ges. m²', 'Kat.', 'Neufert'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ergebnis.raeume.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {r.bezeichnung}
                      {r.anmerkung && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{r.anmerkung}</div>}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{r.anzahl}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.flaeche_je}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 400 }}>{r.flaeche_gesamt}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{ fontSize: '0.65rem', background: kat(r.kategorie) + '22', color: kat(r.kategorie), padding: '0.1rem 0.35rem', borderRadius: 2 }}>{r.kategorie}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.neufert_referenz || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empfehlungen & Neufert */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '1rem 1.25rem' }}>
              <div style={labelStyle}>Empfehlungen</div>
              <ul style={{ paddingLeft: '1rem', marginTop: '0.4rem' }}>
                {ergebnis.empfehlungen.map((e, i) => <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.3rem', lineHeight: 1.5 }}>{e}</li>)}
              </ul>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '1rem 1.25rem' }}>
              <div style={labelStyle}>Neufert-Hinweise</div>
              <ul style={{ paddingLeft: '1rem', marginTop: '0.4rem' }}>
                {ergebnis.neufert_hinweise.map((n, i) => <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.3rem', lineHeight: 1.5 }}>{n}</li>)}
              </ul>
            </div>
          </div>

          {/* Speichern */}
          {!saved && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Name für dieses Raumprogramm" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={saveResult} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--ikb)', border: '1px solid var(--ikb)' }}>Speichern</button>
            </div>
          )}
          {saved && <p style={{ color: 'var(--success, #2D6A4F)', fontSize: '0.82rem' }}>✓ Gespeichert</p>}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.75rem',
  border: '1px solid var(--border-color)', borderRadius: 3,
  background: 'var(--surface)', color: 'var(--text)',
  fontSize: '0.88rem', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-muted)',
  display: 'block', marginBottom: '0.4rem',
}
const btnStyle: React.CSSProperties = {
  padding: '0.55rem 1.5rem',
  background: 'var(--ikb)', color: '#fff',
  border: 'none', borderRadius: 3,
  fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em',
}
