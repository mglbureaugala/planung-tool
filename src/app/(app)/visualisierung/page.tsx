'use client'

import { useState, useRef } from 'react'
import type { BauParam } from '@/lib/bau-types'
import { generateLageplan, generateSchnitt, generateIsometrie } from '@/lib/bau-svg'

export default function VisualisierungPage() {
  const [adresse, setAdresse] = useState('')
  const [flaeche, setFlaeche] = useState('800')
  const [breite, setBreite] = useState('')
  const [tiefe, setTiefe] = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BauParam | null>(null)
  const [error, setError] = useState('')

  const adresseRef = useRef<HTMLInputElement>(null)

  async function berechnen() {
    if (!adresse.trim()) { adresseRef.current?.focus(); return }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/visualisierung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adresse,
          grundstueck_m2: parseFloat(flaeche) || undefined,
          breite_m: parseFloat(breite) || undefined,
          tiefe_m: parseFloat(tiefe) || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '0.4rem' }}>
          Baukörper-Visualisierung
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Maximale Bebauung nach BO Wien — Adresseingabe → automatische Widmungsabfrage → Lageplan, Schnitt, Isometrie
        </p>
      </div>

      {/* Eingabe */}
      <div style={{
        padding: '1.25rem',
        background: 'var(--surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 3,
        marginBottom: '1.25rem',
      }}>

        {/* Adresse */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelTextStyle}>
            Adresse in Wien <span style={{ color: '#999' }}>(Straße + Hausnummer + Bezirk)</span>
          </label>
          <input
            ref={adresseRef}
            style={{ ...inputStyle, width: '100%', maxWidth: 500 }}
            type="text"
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && berechnen()}
            placeholder="z. B. Mariahilfer Straße 100, 1060 Wien"
          />
        </div>

        {/* Grundstück */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Grundstücksfläche m²</span>
            <input style={inputStyle} type="number" value={flaeche}
              onChange={e => setFlaeche(e.target.value)} placeholder="800" />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Breite m <span style={{ color: '#999', fontWeight: 300 }}>(optional)</span></span>
            <input style={inputStyle} type="number" value={breite}
              onChange={e => setBreite(e.target.value)} placeholder="auto" />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Tiefe m <span style={{ color: '#999', fontWeight: 300 }}>(optional)</span></span>
            <input style={inputStyle} type="number" value={tiefe}
              onChange={e => setTiefe(e.target.value)} placeholder="auto" />
          </label>
        </div>

        <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Widmung und Bauklasse werden automatisch aus dem Wiener Flächenwidmungsplan abgefragt (MA 21, Wien OGD).
          Bebauungsplan-Daten fließen ein sofern verfügbar.
        </div>
      </div>

      <button
        onClick={berechnen}
        disabled={loading}
        style={{
          padding: '0.55rem 1.5rem',
          background: loading ? 'var(--text-muted)' : 'var(--ikb)',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          fontSize: '0.8rem',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
          cursor: loading ? 'default' : 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? 'Widmung wird abgefragt…' : 'Baukörper berechnen'}
      </button>

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          background: '#FFF3F3',
          border: '1px solid #E53935',
          borderRadius: 3,
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          color: '#B71C1C',
        }}>
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Quellinfo */}
          <div style={{
            padding: '0.75rem 1.25rem',
            background: '#F0F4FF',
            border: '1px solid var(--ikb)',
            borderRadius: 3,
            marginBottom: '1.5rem',
            fontSize: '0.78rem',
            color: 'var(--ikb)',
          }}>
            <strong>{result.adresse}</strong>
            {result.bezirk ? ` — ${result.bezirk}. Bezirk` : ''}
            {result.widmung !== '—' ? ` — Widmung: ${result.widmung} (${result.widmung_text})` : ''}
            {result.plandokument_nr ? (
              <>
                {' — Bebauungsplan '}
                {result.plandokument_url
                  ? <a href={result.plandokument_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ikb)' }}>
                      Nr. {result.plandokument_nr}
                    </a>
                  : `Nr. ${result.plandokument_nr}`
                }
              </>
            ) : ' — kein analysierter Bebauungsplan verfügbar'}
            {result.schutzzone && <strong style={{ color: '#C62828' }}> — SCHUTZZONE</strong>}
          </div>

          {/* Kennwerte */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))',
            gap: '1px',
            background: 'var(--border-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}>
            {[
              { label: 'Bauklasse', value: `BKl. ${result.bauklasse}` },
              { label: 'Bebauungsweise', value: result.bebauungsweise_text.replace('Bebauungsweise', '').trim() },
              { label: 'Gebäudehöhe §75', value: `${result.gebaeudehoehe_max_m} m` },
              { label: 'Geschosse', value: String(result.max_geschosse) },
              { label: 'Bebauungsgrad §79', value: `${Math.round(result.bebauungsgrad * 100)} %` },
              { label: 'Baukörper', value: `${result.baukörper_breite_m} × ${result.baukörper_tiefe_m} m` },
              { label: 'Bebaute Fläche', value: `${result.bebaute_flaeche_max_m2} m²` },
              { label: 'BGF gesamt', value: `${result.bgf_gesamt_m2} m²` },
              { label: 'NGF geschätzt', value: `${result.ngf_geschaetzt_m2} m²` },
              { label: 'Bauwich seitl.', value: `${result.bauwich_seitlich_m} m` },
              { label: 'Bauwich vorne', value: `${result.bauwich_vorne_m} m` },
              { label: 'Stellplätze §50', value: `${result.stellplaetze_pflicht} SP` },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface)', padding: '0.65rem 0.9rem' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.15rem' }}>
                  {k.label}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--ikb)' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Hinweise & Tipps */}
          {(result.hinweise.length > 0 || result.optimierungstipps.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
              {result.hinweise.length > 0 && (
                <div style={{ padding: '1rem 1.25rem', background: '#FFFBF0', border: '1px solid #F9A825', borderRadius: 3 }}>
                  <div style={{ fontSize: '0.65rem', color: '#795548', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                    Rechtliche Hinweise
                  </div>
                  {result.hinweise.map((h, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', color: '#5D4037', marginBottom: '0.4rem', paddingLeft: '0.75rem', borderLeft: '2px solid #F9A825' }}>
                      {h}
                    </div>
                  ))}
                </div>
              )}
              {result.optimierungstipps.length > 0 && (
                <div style={{ padding: '1rem 1.25rem', background: '#F3F6FF', border: '1px solid var(--ikb)', borderRadius: 3 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--ikb)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                    Optimierungspotenzial
                  </div>
                  {result.optimierungstipps.map((t, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text)', marginBottom: '0.4rem', paddingLeft: '0.75rem', borderLeft: `2px solid var(--ikb)` }}>
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SVG Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: '1.25rem' }}>
            <SvgPanel title="Lageplan" subtitle="Draufsicht · Bauwich · max. Baukörper" svg={generateLageplan(result)} />
            <SvgPanel title="Schnitt" subtitle="Gebäudehöhe §75 BO Wien · Geschosse · Dach" svg={generateSchnitt(result)} />
            <SvgPanel title="Isometrie" subtitle="3D-Baukörper · Maximalausnützung" svg={generateIsometrie(result)} />
          </div>

          {/* Disclaimer */}
          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <strong>Hinweis:</strong> Diese Darstellung basiert auf dem Flächenwidmungsplan Wien (MA 21, Wien OGD) und den Standardwerten der BO Wien.
            Für eine rechtsverbindliche Auskunft ist das zuständige Referat der MA 37 (Baupolizei) zu kontaktieren.
            Plandokumente und Baufluchtlinien können abweichende Festlegungen enthalten.
          </div>
        </>
      )}
    </div>
  )
}

function SvgPanel({ title, subtitle, svg }: { title: string; subtitle: string; svg: string }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 3, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{
        padding: '0.65rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <span style={{ fontSize: '0.78rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--ikb)' }}>{title}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtitle}</span>
      </div>
      <div
        style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem' }
const labelTextStyle: React.CSSProperties = {
  fontSize: '0.65rem', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}
const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.65rem', fontSize: '0.85rem',
  border: '1px solid var(--border-color)', borderRadius: 2,
  background: '#fff', color: 'var(--text)',
  boxSizing: 'border-box',
}
