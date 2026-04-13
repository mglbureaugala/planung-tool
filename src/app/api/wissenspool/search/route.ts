import { NextRequest, NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'


export async function GET(req: NextRequest) {
  
  

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const thema = req.nextUrl.searchParams.get('thema') ?? ''

  if (q.length < 2) return NextResponse.json({ results: [] })

  type Row = { id: string; text: string; seite: number | null; titel: string; thema: string; quelle: string | null; rank: number }

  let rows: Row[]

  if (thema) {
    rows = await prisma.$queryRaw`
      SELECT
        c.id,
        c.text,
        c.seite,
        d.titel,
        d.thema::text,
        d.quelle,
        ts_rank(to_tsvector('german', c.text), plainto_tsquery('german', ${q})) AS rank
      FROM zt_chunks c
      JOIN zt_documents d ON d.id = c."documentId"
      WHERE
        to_tsvector('german', c.text) @@ plainto_tsquery('german', ${q})
        AND d.thema::text = ${thema}
        AND d.veraltet = false
      ORDER BY rank DESC
      LIMIT 20
    `
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        c.id,
        c.text,
        c.seite,
        d.titel,
        d.thema::text,
        d.quelle,
        ts_rank(to_tsvector('german', c.text), plainto_tsquery('german', ${q})) AS rank
      FROM zt_chunks c
      JOIN zt_documents d ON d.id = c."documentId"
      WHERE
        to_tsvector('german', c.text) @@ plainto_tsquery('german', ${q})
        AND d.veraltet = false
      ORDER BY rank DESC
      LIMIT 20
    `
  }

  // Snippet: 300 Zeichen rund um den Suchbegriff
  const term = q.toLowerCase()
  const results = rows.map(r => {
    const lower = r.text.toLowerCase()
    const idx = lower.indexOf(term)
    const start = Math.max(0, idx - 120)
    const end = Math.min(r.text.length, idx + 180)
    const snippet = (start > 0 ? '…' : '') + r.text.slice(start, end) + (end < r.text.length ? '…' : '')
    return {
      id: r.id,
      snippet,
      seite: r.seite,
      titel: r.titel,
      thema: r.thema,
      quelle: r.quelle,
      rank: Number(r.rank),
    }
  })

  return NextResponse.json({ results })
}
