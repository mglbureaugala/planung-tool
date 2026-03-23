import { db as prisma } from '@/lib/db'
import Link from 'next/link'
import styles from './wissenspool.module.css'

const THEMEN = [
  { key: 'BERUFSRECHT',       label: 'Berufsrecht & Standesrecht',      sub: 'ZTG, Standesregeln, Gesellschaftsrecht, Vertragsrecht' },
  { key: 'HAFTUNG',           label: 'Haftung & Vertragsrecht',          sub: 'Gewährleistung, Schadenersatz, Prüf-/Warnpflicht' },
  { key: 'WIENER_BAUORDNUNG', label: 'Wiener Bauordnung',                sub: '§§ Tabellen, Ausnützbarkeit, Stadtplanung, Verfahren' },
  { key: 'BAURECHT_WIEN',     label: 'Baurecht Wien',                    sub: 'Novellen, Nebengesetze, Bebaubarkeit, Stellplätze' },
  { key: 'OIB_RICHTLINIEN',   label: 'OIB Richtlinien',                  sub: 'RL 1–4: Mechanik, Brandschutz, Hygiene, Nutzungssicherheit' },
  { key: 'VERGABERECHT',      label: 'Vergaberecht & Normenwesen',       sub: 'BVergG, ÖNORM, technische Regelwerke' },
  { key: 'RAUMPLANUNG',       label: 'Raumplanung',                      sub: 'ÖREK, Flächenwidmung, Raumordnung' },
  { key: 'GRUNDBUCHSRECHT',   label: 'Grundbuchsrecht',                  sub: 'Grundbuch, Liegenschaftsrecht, Urkunden' },
  { key: 'VERWALTUNGSRECHT',  label: 'Verwaltungsverfahrensrecht',        sub: 'AVG, VwGH, Staatsorganisation' },
  { key: 'BWL',               label: 'BWL & Büroorganisation',            sub: 'Rechnungswesen, Kostenrechnung, Büroführung' },
  { key: 'SOZIALE_ABSICHERUNG', label: 'Soziale Absicherung',            sub: 'SVS, Pensionsrecht, Versicherungen für ZT' },
]

async function getStats() {
  const counts = await prisma.ztDocument.groupBy({
    by: ['thema'],
    _count: { id: true },
  })
  const chunkCounts = await prisma.ztChunk.groupBy({
    by: ['documentId'],
    _count: { id: true },
  })
  // Chunks per Thema via Dokument-Join
  const chunksByThema = await prisma.$queryRaw<{ thema: string; chunks: bigint }[]>`
    SELECT d.thema, COUNT(c.id) as chunks
    FROM zt_documents d
    LEFT JOIN zt_chunks c ON c."documentId" = d.id
    GROUP BY d.thema
  `
  const notesCounts = await prisma.ztUserNote.groupBy({
    by: ['thema'],
    _count: { id: true },
  })

  return { counts, chunksByThema, notesCounts, totalChunks: chunkCounts.length }
}

export default async function WissensPoolPage() {
  const stats = await getStats()

  const docMap = Object.fromEntries(stats.counts.map(c => [c.thema, c._count.id]))
  const chunkMap = Object.fromEntries(stats.chunksByThema.map(c => [c.thema, Number(c.chunks)]))
  const noteMap = Object.fromEntries(stats.notesCounts.map(n => [n.thema, n._count.id]))

  const totalDocs = stats.counts.reduce((s, c) => s + c._count.id, 0)
  const totalChunks = stats.chunksByThema.reduce((s, c) => s + Number(c.chunks), 0)

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '0.5rem' }}>
          ZT Wissenspool
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Spezialisiertes Wissen für die Ziviltechnikerprüfung – durchsuchbar & interaktiv
        </p>
      </div>

      {/* Aktionszeile */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
        <Link href="/wissenspool/suche" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem',
          background: 'var(--ikb)', color: '#fff',
          borderRadius: 3, textDecoration: 'none', fontSize: '0.8rem',
          fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Suche
        </Link>
        <Link href="/wissenspool/chat" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem',
          background: 'var(--surface)', color: 'var(--ikb)',
          border: '1px solid var(--ikb)',
          borderRadius: 3, textDecoration: 'none', fontSize: '0.8rem',
          fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Chat-Assistent
        </Link>
      </div>

      {/* Statistik */}
      {totalDocs > 0 && (
        <div style={{
          display: 'flex', gap: '2rem', marginBottom: '2rem',
          padding: '1rem 1.25rem',
          background: 'var(--surface)', border: '1px solid var(--border-color)',
          borderRadius: 3, fontSize: '0.8rem',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>Dokumente</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--ikb)' }}>{totalDocs}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>Textabschnitte</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--ikb)' }}>{totalChunks.toLocaleString('de')}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>Eigene Notizen</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--ikb)' }}>
              {Object.values(noteMap).reduce((s, v) => s + v, 0)}
            </div>
          </div>
        </div>
      )}

      {totalDocs === 0 && (
        <div style={{
          padding: '1.5rem', background: '#FFF8E1', border: '1px solid #F9A825',
          borderRadius: 3, marginBottom: '2rem', fontSize: '0.85rem', color: '#5D4037',
        }}>
          <strong>Noch keine Dokumente indexiert.</strong><br />
          Führe den Ingestion-Script aus:<br />
          <code style={{ fontFamily: 'monospace', marginTop: '0.5rem', display: 'block' }}>
            cd ~/pe-tool && npx tsx scripts/ingest-zt.ts
          </code>
        </div>
      )}

      {/* Themen-Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1px',
        background: 'var(--border-color)',
        border: '1px solid var(--border-color)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        {THEMEN.map(t => {
          const docs = docMap[t.key] ?? 0
          const notes = noteMap[t.key] ?? 0
          return (
            <Link
              key={t.key}
              href={`/wissenspool/thema/${t.key.toLowerCase()}`}
              style={{ textDecoration: 'none' }}
            >
              <div className={styles.themaCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 400, fontSize: '0.9rem', color: 'var(--text)' }}>
                    {t.label}
                  </span>
                  {docs > 0 && (
                    <span style={{
                      fontSize: '0.65rem', color: 'var(--ikb)', background: '#EEF2FF',
                      padding: '0.1rem 0.4rem', borderRadius: 2, whiteSpace: 'nowrap', marginLeft: '0.5rem',
                    }}>
                      {docs} Dok.
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.sub}</div>
                {notes > 0 && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-light)' }}>
                    {notes} eigene {notes === 1 ? 'Notiz' : 'Notizen'}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
