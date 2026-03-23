'use client'

import { useState, useRef } from 'react'
import type { BauParam } from '@/lib/bau-types'
import { generateLageplan, generateSchnitt, generateIsometrie } from '@/lib/bau-svg'

type ResultData = BauParam & { bebauungsweise_quelle?: string; modus?: string }

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem' }
const labelTextStyle: React.CSSProperties = {
  fontSize: '0.62rem', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}
const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.65rem', fontSize: '0.85rem',
  border: '1px solid var(--border-color)', borderRadius: 2,
  background: '#fff', color: 'var(--text)',
  boxSizing: 'border-box', width: '100%',
}
const sectionTitle: React.CSSProperties = {
  fontSize: '0.62rem', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: '0.75rem', paddingBottom: '0.4rem',
  borderBottom: '1px solid var(--border-color)',
}
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
  gap: '0.85rem',
}

// ─── Shared Result Component ──────────────────────────────────────────────────

function ResultView({ result }: { result: ResultData }) {
  return (
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
        <strong>{result.adresse || 'Manuelle Eingabe'}</strong>
        {result.bezirk ? ` — ${result.bezirk}. Bezirk` : ''}
        {result.widmung !== '—' ? ` — ${result.widmung} (${result.widmung_text})` : ''}
        {result.bebauungsweise ? ` — ${result.bebauungsweise_text}` : ''}
        {result.bebauungsweise_quelle && result.bebauungsweise_quelle !== 'manuell'
          ? <span style={{ color: '#6B7ABD', fontSize: '0.72rem' }}> [{result.bebauungsweise_quelle}]</span>
          : null}
        {result.plandokument_nr ? (
          <>
            {' — Plandok. '}
            {result.plandokument_url
              ? <a href={result.plandokument_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ikb)' }}>
                  Nr. {result.plandokument_nr}
                </a>
              : `Nr. ${result.plandokument_nr}`}
          </>
        ) : null}
        {result.schutzzone && <strong style={{ color: '#C62828' }}> — SCHUTZZONE</strong>}
        {result.kg && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#6B7ABD' }}>
            · KG {result.kg} / GNr. {result.gnr}{result.ez ? ` / EZ ${result.ez}` : ''} (BEV Kataster)
          </span>
        )}
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
          { label: 'Bebauungsweise', value: result.bebauungsweise_text?.replace('Bebauungsweise', '').trim() || '—' },
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
          ...(result.kg ? [
            { label: 'KG-Nr. (BEV)', value: result.kg },
            { label: 'Grundst.-Nr.', value: result.gnr ?? '—' },
          ] : []),
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', padding: '0.65rem 0.9rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.15rem' }}>
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
              <div style={{ fontSize: '0.62rem', color: '#795548', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
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
              <div style={{ fontSize: '0.62rem', color: 'var(--ikb)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
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
        <strong>Hinweis:</strong> Diese Darstellung zeigt die theoretisch maximale Ausnützung nach BO Wien (LGBl. Nr. 11/1930 idgF.).
        Abweichende Festlegungen aus Bebauungsplänen (MA 21), Baufluchtlinien oder Sonderparagrafen sind gesondert zu prüfen.
        Für rechtsverbindliche Auskünfte: MA 37 (Baupolizei).
      </div>
    </>
  )
}

// ─── Tab 1: Manuelle Eingabe ─────────────────────────────────────────────────

function ManuellTab() {
  const [flaeche, setFlaeche] = useState('800')
  const [breite, setBreite] = useState('')
  const [tiefe, setTiefe] = useState('')
  const [bauklasse, setBauklasse] = useState('II')
  const [bebauungsweise, setBebauungsweise] = useState('g')
  const [gebaeudehoehe, setGebaeudehoehe] = useState('')
  const [bebauungsgrad, setBebauungsgrad] = useState('')
  const [baufluchtVorne, setBaufluchtVorne] = useState('')
  const [baufluchtSeitlich, setBaufluchtSeitlich] = useState('')
  const [baufluchtHinten, setBaufluchtHinten] = useState('')
  const [plandokNr, setPlandokNr] = useState('')
  const [schutzzone, setSchutzzone] = useState(false)
  const [bezeichnung, setBezeichnung] = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [error, setError] = useState('')

  async function berechnen() {
    if (!flaeche || !bauklasse || !bebauungsweise) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/visualisierung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modus: 'manuell',
          bezeichnung: bezeichnung || undefined,
          grundstueck_m2: parseFloat(flaeche),
          breite_m: parseFloat(breite) || undefined,
          tiefe_m: parseFloat(tiefe) || undefined,
          bauklasse,
          bebauungsweise,
          gebaeudehoehe_override: parseFloat(gebaeudehoehe) || undefined,
          bebauungsgrad_override: parseFloat(bebauungsgrad) / 100 || undefined,
          bauwich_vorne_override: parseFloat(baufluchtVorne) || undefined,
          bauwich_seitlich_override: parseFloat(baufluchtSeitlich) || undefined,
          bauwich_hinten_override: parseFloat(baufluchtHinten) || undefined,
          plandokument_nr: plandokNr || undefined,
          schutzzone,
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
    <div>
      {/* Formular */}
      <div style={{ padding: '1.25rem', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, marginBottom: '1.25rem' }}>

        {/* Grundstück */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={sectionTitle}>Grundstück</div>
          <div style={gridStyle}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Fläche m² <span style={{ color: '#E53935' }}>*</span></span>
              <input style={inputStyle} type="number" value={flaeche} onChange={e => setFlaeche(e.target.value)} placeholder="800" />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Breite m <span style={{ color: '#999', fontWeight: 300 }}>(optional)</span></span>
              <input style={inputStyle} type="number" value={breite} onChange={e => setBreite(e.target.value)} placeholder="auto" />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Tiefe m <span style={{ color: '#999', fontWeight: 300 }}>(optional)</span></span>
              <input style={inputStyle} type="number" value={tiefe} onChange={e => setTiefe(e.target.value)} placeholder="auto" />
            </label>
          </div>
        </div>

        {/* Flächenwidmung */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={sectionTitle}>Flächenwidmung — Pflichtangaben aus FWP (MA 21)</div>
          <div style={gridStyle}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Bauklasse §76 <span style={{ color: '#E53935' }}>*</span></span>
              <select style={inputStyle} value={bauklasse} onChange={e => setBauklasse(e.target.value)}>
                <option value="I">BKl. I — bis 4,5 m / 1 Gesch.</option>
                <option value="II">BKl. II — bis 7,5 m / 2 Gesch.</option>
                <option value="III">BKl. III — bis 10,5 m / 3 Gesch.</option>
                <option value="IV">BKl. IV — bis 16,0 m / 5 Gesch.</option>
                <option value="V">BKl. V — bis 26,0 m / 8 Gesch.</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Bebauungsweise §77 <span style={{ color: '#E53935' }}>*</span></span>
              <select style={inputStyle} value={bebauungsweise} onChange={e => setBebauungsweise(e.target.value)}>
                <option value="g">Geschlossen (g) — kein Bauwich</option>
                <option value="gr">Gemischt/Gründerzeit (gr) — wie geschlossen</option>
                <option value="o">Offen (o) — seitl. Bauwich</option>
                <option value="gk">Gekuppelt (gk) — einseitiger Bauwich</option>
              </select>
            </label>
          </div>
        </div>

        {/* Bebauungsplan-Overrides */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={sectionTitle}>Bebauungsplan — Overrides (leer = BO Wien §§76–79 Standardwert)</div>
          <div style={gridStyle}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Max. Gebäudehöhe m §75</span>
              <input style={inputStyle} type="number" value={gebaeudehoehe} onChange={e => setGebaeudehoehe(e.target.value)} placeholder={`auto (BKl. ${bauklasse})`} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Bebauungsgrad % §79</span>
              <input style={inputStyle} type="number" value={bebauungsgrad} onChange={e => setBebauungsgrad(e.target.value)} placeholder="auto (§79)" />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Bauwich vorne m §78</span>
              <input style={inputStyle} type="number" value={baufluchtVorne} onChange={e => setBaufluchtVorne(e.target.value)} placeholder="auto (§78)" />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Bauwich seitlich m §78</span>
              <input style={inputStyle} type="number" value={baufluchtSeitlich} onChange={e => setBaufluchtSeitlich(e.target.value)} placeholder="auto (§78)" />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Bauwich hinten m §78</span>
              <input style={inputStyle} type="number" value={baufluchtHinten} onChange={e => setBaufluchtHinten(e.target.value)} placeholder="auto (§78)" />
            </label>
          </div>
        </div>

        {/* Zusatzinfos */}
        <div>
          <div style={sectionTitle}>Zusatzinfos (optional — nur für Anzeige)</div>
          <div style={gridStyle}>
            <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
              <span style={labelTextStyle}>Adresse / Projektbezeichnung</span>
              <input style={inputStyle} type="text" value={bezeichnung} onChange={e => setBezeichnung(e.target.value)} placeholder="z. B. Musterstraße 1, 1010 Wien" />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Plandokument-Nr.</span>
              <input style={inputStyle} type="text" value={plandokNr} onChange={e => setPlandokNr(e.target.value)} placeholder="z. B. 7987" />
            </label>
            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '0.5rem', paddingTop: '1.15rem' }}>
              <input
                type="checkbox" checked={schutzzone} onChange={e => setSchutzzone(e.target.checked)}
                style={{ width: 14, height: 14, flexShrink: 0 }}
              />
              <span style={{ ...labelTextStyle, textTransform: 'none', letterSpacing: 0, fontSize: '0.78rem' }}>
                Schutzzone §2 Z 52 BO Wien
              </span>
            </label>
          </div>
        </div>
      </div>

      <button
        onClick={berechnen} disabled={loading || !flaeche || !bauklasse || !bebauungsweise}
        style={{
          padding: '0.55rem 1.5rem',
          background: (loading || !flaeche) ? 'var(--text-muted)' : 'var(--ikb)',
          color: '#fff', border: 'none', borderRadius: 3,
          fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
          cursor: (loading || !flaeche) ? 'default' : 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? 'Wird berechnet…' : 'Baukörper berechnen'}
      </button>

      {error && <ErrorBox msg={error} />}
      {result && <ResultView result={result} />}
    </div>
  )
}

// ─── Tab 2: Adressabfrage ─────────────────────────────────────────────────────

function AdressTab() {
  const [adresse, setAdresse] = useState('')
  const [flaeche, setFlaeche] = useState('800')
  const [breite, setBreite] = useState('')
  const [tiefe, setTiefe] = useState('')
  const [bebauungsweise, setBebauungsweise] = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [error, setError] = useState('')

  const adresseRef = useRef<HTMLInputElement>(null)

  async function berechnen() {
    if (!adresse.trim()) { adresseRef.current?.focus(); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/visualisierung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modus: 'adresse',
          adresse,
          grundstueck_m2: parseFloat(flaeche) || undefined,
          breite_m: parseFloat(breite) || undefined,
          tiefe_m: parseFloat(tiefe) || undefined,
          bebauungsweise_override: bebauungsweise || undefined,
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
    <div>
      <div style={{ padding: '1.25rem', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 3, marginBottom: '1.25rem' }}>

        {/* Adresse */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={sectionTitle}>Adresse Wien — Widmung + Bauklasse werden automatisch abgefragt</div>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Adresse in Wien <span style={{ color: '#999', fontWeight: 300 }}>(Straße + Hausnummer + Bezirk)</span></span>
            <input
              ref={adresseRef}
              style={{ ...inputStyle, maxWidth: 520 }}
              type="text"
              value={adresse}
              onChange={e => setAdresse(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && berechnen()}
              placeholder="z. B. Mariahilfer Straße 100, 1060 Wien"
            />
          </label>
        </div>

        {/* Grundstück + Bebauungsweise */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.85rem' }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Grundstücksfläche m²</span>
            <input style={inputStyle} type="number" value={flaeche} onChange={e => setFlaeche(e.target.value)} placeholder="800" />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Breite m <span style={{ color: '#999', fontWeight: 300 }}>(opt.)</span></span>
            <input style={inputStyle} type="number" value={breite} onChange={e => setBreite(e.target.value)} placeholder="auto" />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Tiefe m <span style={{ color: '#999', fontWeight: 300 }}>(opt.)</span></span>
            <input style={inputStyle} type="number" value={tiefe} onChange={e => setTiefe(e.target.value)} placeholder="auto" />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Bebauungsweise §77 <span style={{ color: '#999', fontWeight: 300 }}>(opt. Override)</span></span>
            <select style={inputStyle} value={bebauungsweise} onChange={e => setBebauungsweise(e.target.value)}>
              <option value="">— aus Plandokument / Bezirk —</option>
              <option value="g">Geschlossen (g)</option>
              <option value="gr">Gemischt/Gründerzeit (gr)</option>
              <option value="o">Offen (o)</option>
              <option value="gk">Gekuppelt (gk)</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: '0.9rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Widmung und Bauklasse: Wien OGD WFS (MA 21, GENFLWIDMUNGOGD) ·
          Bebauungsweise: Plandokument-DB (wird aufgebaut) oder Bezirk-Richtwert ·
          Für präzise Ergebnisse: Bebauungsweise manuell wählen oder Tab „Manuelle Eingabe" verwenden.
        </div>
      </div>

      <button
        onClick={berechnen} disabled={loading}
        style={{
          padding: '0.55rem 1.5rem',
          background: loading ? 'var(--text-muted)' : 'var(--ikb)',
          color: '#fff', border: 'none', borderRadius: 3,
          fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
          cursor: loading ? 'default' : 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? 'Widmung wird abgefragt…' : 'Baukörper berechnen'}
      </button>

      {error && <ErrorBox msg={error} />}
      {result && <ResultView result={result} />}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: '1rem 1.25rem',
      background: '#FFF3F3', border: '1px solid #E53935',
      borderRadius: 3, marginBottom: '1.5rem',
      fontSize: '0.85rem', color: '#B71C1C',
    }}>
      {msg}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VisualisierungPage() {
  const [tab, setTab] = useState<'manuell' | 'adresse'>('manuell')

  const tabBtn = (id: 'manuell' | 'adresse', label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '0.5rem 1.25rem',
        background: tab === id ? 'var(--ikb)' : 'transparent',
        color: tab === id ? '#fff' : 'var(--text-muted)',
        border: tab === id ? '1px solid var(--ikb)' : '1px solid var(--border-color)',
        borderRadius: 2,
        fontSize: '0.75rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        cursor: 'pointer',
        marginRight: '0.5rem',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ padding: '2rem', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '0.4rem' }}>
          Baukörper-Visualisierung
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Maximale Bebauung nach BO Wien (LGBl. Nr. 11/1930 idgF.) — §§75–81 Gebäudehöhe, Bauwich, Bebauungsgrad
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '1.5rem' }}>
        {tabBtn('manuell', 'Manuelle Eingabe')}
        {tabBtn('adresse', 'Adressabfrage')}
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
          {tab === 'manuell'
            ? 'Alle Parameter bekannt → präzise deterministische Berechnung'
            : 'Adresse → automatische Widmungs- und Plandokumentabfrage'}
        </span>
      </div>

      {tab === 'manuell' ? <ManuellTab /> : <AdressTab />}
    </div>
  )
}
