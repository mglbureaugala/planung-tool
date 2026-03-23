'use client'

import { useState } from 'react'
import { generateLageplan, generateSchnitt, generateIsometrie, BauParam } from '@/lib/bau-svg'

const BAUKLASSEN = ['I', 'II', 'III', 'IV']
const WIDMUNGEN = ['W1', 'W2', 'W3', 'GB', 'G', 'MK', 'MU']
const BAUWEISEN = ['offen', 'geschlossen', 'gekuppelt']

export default function VisualisierungPage() {
  const [form, setForm] = useState({
    grundstueck_m2: '800',
    breite_m: '25',
    tiefe_m: '',
    bauklasse: 'II',
    widmung: 'W2',
    bauweise: 'offen',
    bebauungsplan: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BauParam | null>(null)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function berechnen() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/visualisierung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fehler')
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1200 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '0.4rem' }}>
          Baukörper-Visualisierung
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Maximale Ausnutzung nach Wiener Bauordnung — Lageplan, Schnitt, Isometrie
        </p>
      </div>

      {/* Eingabeformular */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1.25rem',
        background: 'var(--surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 3,
      }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Grundstück m²</span>
          <input
            style={inputStyle}
            type="number"
            value={form.grundstueck_m2}
            onChange={e => set('grundstueck_m2', e.target.value)}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Breite m</span>
          <input
            style={inputStyle}
            type="number"
            value={form.breite_m}
            onChange={e => set('breite_m', e.target.value)}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Tiefe m (optional)</span>
          <input
            style={inputStyle}
            type="number"
            value={form.tiefe_m}
            onChange={e => set('tiefe_m', e.target.value)}
            placeholder="auto"
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Bauklasse</span>
          <select style={inputStyle} value={form.bauklasse} onChange={e => set('bauklasse', e.target.value)}>
            {BAUKLASSEN.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Widmung</span>
          <select style={inputStyle} value={form.widmung} onChange={e => set('widmung', e.target.value)}>
            {WIDMUNGEN.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Bauweise</span>
          <select style={inputStyle} value={form.bauweise} onChange={e => set('bauweise', e.target.value)}>
            {BAUWEISEN.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
          <span style={labelTextStyle}>Bebauungsplan-Hinweise (optional)</span>
          <input
            style={inputStyle}
            type="text"
            value={form.bebauungsplan}
            onChange={e => set('bebauungsplan', e.target.value)}
            placeholder="z.B. vorderer Bauwich 8m, max. 3 Geschosse"
          />
        </label>
      </div>

      <button
        onClick={berechnen}
        disabled={loading}
        style={{
          padding: '0.6rem 1.5rem',
          background: loading ? 'var(--text-muted)' : 'var(--ikb)',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: loading ? 'default' : 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? 'Berechne…' : 'Baukörper berechnen'}
      </button>

      {error && (
        <div style={{ padding: '1rem', background: '#FFF3F3', border: '1px solid #E53935', borderRadius: 3, marginBottom: '1.5rem', fontSize: '0.85rem', color: '#B71C1C' }}>
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Kennzahlen */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '1px',
            background: 'var(--border-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: '2rem',
          }}>
            {[
              { label: 'Bauklasse', value: result.bauklasse },
              { label: 'Bauweise', value: result.bauweise },
              { label: 'GRZ max', value: result.grz_max.toFixed(2) },
              { label: 'GFZ max', value: result.gfz_max.toFixed(2) },
              { label: 'Geschosse', value: String(result.max_geschosse) },
              { label: 'Traufe', value: `${result.traufenhoehe_m} m` },
              { label: 'First', value: `${result.firsthoehe_m} m` },
              { label: 'Baukörper', value: `${result.baukörper_breite_m} × ${result.baukörper_tiefe_m} m` },
              { label: 'Bebaub. Fläche', value: `${result.bebaubare_flaeche_m2} m²` },
              { label: 'BGF gesamt', value: `${result.bgf_gesamt_m2} m²` },
              { label: 'WNF geschätzt', value: `${result.wnf_geschaetzt_m2} m²` },
              { label: 'Stellplätze', value: String(result.stellplaetze_pflicht) },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface)', padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>{k.label}</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--ikb)', fontWeight: 400 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Hinweise & Tipps */}
          {(result.hinweise?.length > 0 || result.optimierungstipps?.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              {result.hinweise?.length > 0 && (
                <div style={{ padding: '1rem', background: '#FFF8E1', border: '1px solid #F9A825', borderRadius: 3 }}>
                  <div style={{ fontSize: '0.65rem', color: '#795548', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Hinweise</div>
                  {result.hinweise.map((h, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: '#5D4037', marginBottom: '0.3rem' }}>— {h}</div>
                  ))}
                </div>
              )}
              {result.optimierungstipps?.length > 0 && (
                <div style={{ padding: '1rem', background: '#F3F8FF', border: '1px solid var(--ikb)', borderRadius: 3 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--ikb)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Optimierungstipps</div>
                  {result.optimierungstipps.map((t, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.3rem' }}>— {t}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SVG Visualisierungen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '1.5rem' }}>
            <SvgPanel title="Lageplan" subtitle="Grundriss / Draufsicht" svg={generateLageplan(result)} />
            <SvgPanel title="Schnitt" subtitle="Gebäudeschnitt / Ansicht" svg={generateSchnitt(result)} />
            <SvgPanel title="Isometrie" subtitle="3D-Baukörper" svg={generateIsometrie(result)} />
          </div>
        </>
      )}
    </div>
  )
}

function SvgPanel({ title, subtitle, svg }: { title: string; subtitle: string; svg: string }) {
  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 3,
      overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ikb)' }}>{title}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtitle}</span>
      </div>
      <div
        style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
}

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  fontSize: '0.85rem',
  border: '1px solid var(--border-color)',
  borderRadius: 2,
  background: '#fff',
  color: 'var(--text)',
  width: '100%',
  boxSizing: 'border-box',
}
