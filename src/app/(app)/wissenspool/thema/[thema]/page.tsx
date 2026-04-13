export const dynamic = 'force-dynamic'

import { db as prisma } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { NotizenPanel } from './NotizenPanel'

const THEMEN: Record<string, { label: string; sub: string }> = {
  berufsrecht:       { label: 'Berufsrecht & Standesrecht',   sub: 'ZTG, Standesregeln, Gesellschaftsrecht, Vertragsrecht' },
  haftung:           { label: 'Haftung & Vertragsrecht',       sub: 'Gewährleistung, Schadenersatz, Prüf-/Warnpflicht' },
  wiener_bauordnung: { label: 'Wiener Bauordnung',             sub: '§§ Tabellen, Ausnützbarkeit, Stadtplanung, Verfahren' },
  baurecht_wien:     { label: 'Baurecht Wien',                 sub: 'Novellen, Nebengesetze, Bebaubarkeit, Stellplätze' },
  oib_richtlinien:   { label: 'OIB Richtlinien',               sub: 'RL 1–4: Mechanik, Brandschutz, Hygiene, Nutzungssicherheit' },
  vergaberecht:      { label: 'Vergaberecht & Normenwesen',    sub: 'BVergG, ÖNORM, technische Regelwerke' },
  raumplanung:       { label: 'Raumplanung',                   sub: 'ÖREK, Flächenwidmung, Raumordnung' },
  grundbuchsrecht:   { label: 'Grundbuchsrecht',               sub: 'Grundbuch, Liegenschaftsrecht, Urkunden' },
  verwaltungsrecht:  { label: 'Verwaltungsverfahrensrecht',    sub: 'AVG, VwGH, Staatsorganisation' },
  bwl:               { label: 'BWL & Büroorganisation',        sub: 'Rechnungswesen, Kostenrechnung, Büroführung' },
  soziale_absicherung: { label: 'Soziale Absicherung',         sub: 'SVS, Pensionsrecht, Versicherungen für ZT' },
}

export default async function ThemaPage({ params }: { params: Promise<{ thema: string }> }) {
  const { thema } = await params
  const meta = THEMEN[thema]
  if (!meta) notFound()

  const themaEnum = thema.toUpperCase() as never

  const dokumente = await prisma.ztDocument.findMany({
    where: { thema: themaEnum },
    include: { _count: { select: { chunks: true } } },
    orderBy: [{ quelle: 'asc' }, { titel: 'asc' }],
  })

  const notizen = await prisma.ztUserNote.findMany({
    where: { thema: themaEnum },
    orderBy: { aktualisiertAm: 'desc' },
  })

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>

      {/* Breadcrumb */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        <Link href="/wissenspool" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Wissenspool</Link>
        {' / '}
        <span>{meta.label}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="section-title" style={{ fontSize: '1.1rem', color: 'var(--ikb)', marginBottom: '0.4rem' }}>
          {meta.label}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{meta.sub}</p>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <Link href={`/wissenspool/suche?thema=${thema.toUpperCase()}`} style={{
          padding: '0.4rem 0.9rem', fontSize: '0.75rem',
          background: 'var(--ikb)', color: '#fff',
          borderRadius: 3, textDecoration: 'none',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Suchen in diesem Thema
        </Link>
        <Link href={`/wissenspool/chat?thema=${thema.toUpperCase()}`} style={{
          padding: '0.4rem 0.9rem', fontSize: '0.75rem',
          background: 'var(--surface)', color: 'var(--ikb)',
          border: '1px solid var(--ikb)',
          borderRadius: 3, textDecoration: 'none',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Chat
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>

        {/* Dokumente */}
        <div>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            {dokumente.length} Dokumente
          </div>
          {dokumente.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Noch keine Dokumente. Ingestion-Script ausführen.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-color)', border: '1px solid var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
              {dokumente.map(d => (
                <div key={d.id} style={{ background: d.veraltet ? '#fffbf0' : 'var(--surface)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: d.veraltet ? '#a07800' : 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {d.titel}
                      {d.veraltet && (
                        <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: '#fff', padding: '0.1rem 0.35rem', borderRadius: 2, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                          VERALTET
                        </span>
                      )}
                    </div>
                    {d.quelle && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.quelle}</div>}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    {d._count.chunks} Abschnitte
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notizen */}
        <NotizenPanel thema={thema.toUpperCase()} initialNotizen={notizen} />
      </div>
    </div>
  )
}
