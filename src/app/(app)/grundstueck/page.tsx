'use client'

import { useState } from 'react'

const WIDMUNGEN = [
  'W – Wohngebiet',
  'W1 – Wohngebiet (geringer Bebauungsdichte)',
  'W2 – Wohngebiet (mittlerer Bebauungsdichte)',
  'WB – Wohngebiet mit Betriebsstätten',
  'GB – Gemischtes Baugebiet',
  'BG – Baugebiet für Gewerbe',
  'GG – Gemischt genutztes Gebiet',
  'Sonstiges / unbekannt',
]

type Ergebnis = {
  bebaubarkeit: {
    gfz_max: number; grz_max: number; bgf_max: number
    bebaute_flaeche_max: number; geschosse_typisch: number
    gebaeudehoeche_max: string
  }
  nutzungsszenarien: {
    typ: string; bgf: number; we_anzahl?: number
    we_groesse_avg?: number; nebenflaechen: number; bemerkung: string
  }[]
  parkierung: {
    pflicht_je_we: number; gesamt_pflicht: number
    stellplaetze_eg: number; tiefgarage_empfohlen: boolean; bemerkung: string
  }
  wirtschaftlichkeit: { bri_schaetzung: number; effizienz_hnf_bgf: string; empfehlung: string }
  risiken: string[]
  naechste_schritte: string[]
}

export default function GrundstueckPage() {
  const [flaeche, setFlaeche] = useState('')
  const [widmung, setWidmung] = useState('')
  const [lage, setLage] = useState('')
  const [bebauungsplan, setBebauungsplan] = useState('')
  const [loading, setLoading] = useState(false)
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)

  async function check() {
    if (!flaeche) return
    setLoading(true)
    setErgebnis(null)
    try {
      const res = await fetch('/api/grundstueck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grundstueck_m2: parseFloat(flaeche),
          widmung, lage: lage || 'Wien',
          bebauungsplan,
        }),
      })
      const data = await res.json()
      setErgebnis(data.ergebnis)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 960 }}>
      <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '0.4rem' }}>
        Grundstück-Schnellcheck
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.75rem' }}>
        Bebaubarkeit, Nutzungsszenarien und Parkierung nach Wiener Bauordnung
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>Grundstücksfläche (m²) *</label>
          <input type="number" value={flaeche} onChange={e => setFlaeche(e.target.value)}
            placeholder="z.B. 850" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Widmung</label>
          <select value={widmung} onChange={e => setWidmung(e.target.value)} style={inputStyle}>
            <option value="">— unbekannt / allgemein —</option>
            {WIDMUNGEN.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Lage / Bezirk</label>
          <input value={lage} onChange={e => setLage(e.target.value)}
            placeholder="z.B. Wien 10, Favoriten" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Bebauungsplan (optional)</label>
          <input value={bebauungsplan} onChange={e => setBebauungsplan(e.target.value)}
            placeholder="z.B. Baufluchtlinie, max. 4 Geschosse" style={inputStyle} />
        </div>
      </div>

      <button onClick={check} disabled={loading || !flaeche} style={btnStyle}>
        {loading ? 'Analysiere…' : 'Schnellcheck starten'}
      </button>

      {ergebnis && (
        <div style={{ marginTop: '2rem' }}>

          {/* Bebaubarkeit */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Bebaubarkeit</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {[
                { label: 'GFZ max.', val: ergebnis.bebaubarkeit.gfz_max },
                { label: 'GRZ max.', val: ergebnis.bebaubarkeit.grz_max },
                { label: 'BGF max.', val: `${ergebnis.bebaubarkeit.bgf_max.toLocaleString('de')} m²` },
                { label: 'Bebaute Fläche max.', val: `${ergebnis.bebaubarkeit.bebaute_flaeche_max} m²` },
                { label: 'Geschosse typisch', val: ergebnis.bebaubarkeit.geschosse_typisch },
                { label: 'Gebäudehöhe max.', val: ergebnis.bebaubarkeit.gebaeudehoeche_max },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '0.8rem 1rem' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{item.label}</div>
                  <div style={{ fontSize: '1.15rem', color: 'var(--ikb)', marginTop: '0.15rem' }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nutzungsszenarien */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Nutzungsszenarien</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-color)' }}>
                    {['Nutzung', 'BGF', 'WE', 'Ø WE-Größe', 'Bemerkung'].map(h => (
                      <th key={h} style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ergebnis.nutzungsszenarien.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 400 }}>{s.typ}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.bgf.toLocaleString('de')} m²</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.we_anzahl ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.we_groesse_avg ? `${s.we_groesse_avg} m²` : '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.bemerkung}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Parkierung */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Parkierung</div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text)' }}>
                <div>Pflicht gesamt: <strong>{ergebnis.parkierung.gesamt_pflicht} SP</strong></div>
                <div>EG-Stellplätze: {ergebnis.parkierung.stellplaetze_eg}</div>
                <div>Tiefgarage: {ergebnis.parkierung.tiefgarage_empfohlen ? 'empfohlen' : 'nicht erforderlich'}</div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{ergebnis.parkierung.bemerkung}</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Wirtschaftlichkeit</div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text)' }}>
                <div>Effizienz HNF/BGF: <strong>{ergebnis.wirtschaftlichkeit.effizienz_hnf_bgf}</strong></div>
                {ergebnis.wirtschaftlichkeit.bri_schaetzung > 0 && (
                  <div>BRI Schätzung: {ergebnis.wirtschaftlichkeit.bri_schaetzung.toLocaleString('de')} m³</div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{ergebnis.wirtschaftlichkeit.empfehlung}</div>
            </div>
          </div>

          {/* Risiken & Schritte */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: '#FFF8E1', border: '1px solid #F9A825', borderRadius: 3, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#B45309', marginBottom: '0.6rem' }}>Risiken / Hinweise</div>
              <ul style={{ paddingLeft: '1rem' }}>
                {ergebnis.risiken.map((r, i) => <li key={i} style={{ fontSize: '0.82rem', color: '#5D4037', marginBottom: '0.3rem', lineHeight: 1.5 }}>{r}</li>)}
              </ul>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Nächste Schritte</div>
              <ul style={{ paddingLeft: '1rem' }}>
                {ergebnis.naechste_schritte.map((s, i) => <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.3rem', lineHeight: 1.5 }}>{s}</li>)}
              </ul>
            </div>
          </div>
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
