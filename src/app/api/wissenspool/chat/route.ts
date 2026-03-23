import { NextRequest, NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const THEMA_LABELS: Record<string, string> = {
  BERUFSRECHT: 'Berufsrecht & Standesrecht',
  HAFTUNG: 'Haftung & Vertragsrecht',
  WIENER_BAUORDNUNG: 'Wiener Bauordnung',
  BAURECHT_WIEN: 'Baurecht Wien',
  OIB_RICHTLINIEN: 'OIB Richtlinien',
  VERGABERECHT: 'Vergaberecht & Normenwesen',
  RAUMPLANUNG: 'Raumplanung',
  GRUNDBUCHSRECHT: 'Grundbuchsrecht',
  VERWALTUNGSRECHT: 'Verwaltungsverfahrensrecht',
  BWL: 'BWL & Büroorganisation',
  SOZIALE_ABSICHERUNG: 'Soziale Absicherung',
}

type ChunkRow = { text: string; titel: string; thema: string; quelle: string | null; seite: number | null }

export async function POST(req: NextRequest) {
  
  

  const { frage, thema } = await req.json() as { frage: string; thema?: string }

  if (!frage?.trim()) return NextResponse.json({ error: 'Keine Frage' }, { status: 400 })

  // Relevante Chunks per FTS laden
  let chunks: ChunkRow[]
  if (thema) {
    chunks = await prisma.$queryRaw`
      SELECT c.text, d.titel, d.thema::text, d.quelle, c.seite
      FROM zt_chunks c
      JOIN zt_documents d ON d.id = c."documentId"
      WHERE
        to_tsvector('german', c.text) @@ plainto_tsquery('german', ${frage})
        AND d.thema::text = ${thema}
      ORDER BY ts_rank(to_tsvector('german', c.text), plainto_tsquery('german', ${frage})) DESC
      LIMIT 12
    `
  } else {
    chunks = await prisma.$queryRaw`
      SELECT c.text, d.titel, d.thema::text, d.quelle, c.seite
      FROM zt_chunks c
      JOIN zt_documents d ON d.id = c."documentId"
      WHERE to_tsvector('german', c.text) @@ plainto_tsquery('german', ${frage})
      ORDER BY ts_rank(to_tsvector('german', c.text), plainto_tsquery('german', ${frage})) DESC
      LIMIT 12
    `
  }

  const kontext = chunks.map(c => {
    const label = THEMA_LABELS[c.thema] ?? c.thema
    const seiteInfo = c.seite ? ` (S. ${c.seite})` : ''
    return `[${label} – ${c.quelle ?? c.titel}${seiteInfo}]\n${c.text}`
  }).join('\n\n---\n\n')

  const systemPrompt = `Du bist ein Experte für österreichisches Ziviltechnikerrecht und Baurecht.
Du hilfst Architekt DI Matthias Garzon-Lapierre bei der Pflege und Vertiefung seines Fachwissens als Ziviltechniker.
Antworte präzise, fachlich korrekt und auf Deutsch. Beziehe dich auf die bereitgestellten Quellen.
Wenn die Quellen keine ausreichende Antwort liefern, weise darauf hin.
Nutze österreichische Rechtschreibweise und Fachterminologie (§§, BO, WBO, AVG, ZTG etc.).`

  const userMessage = kontext
    ? `Aus meinen Unterlagen:\n\n${kontext}\n\n---\n\nMeine Frage: ${frage}`
    : frage

  // Streaming Response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        // Quellen anhängen
        if (chunks.length > 0) {
          const quellen = [...new Set(chunks.map(c =>
            `${THEMA_LABELS[c.thema] ?? c.thema}: ${c.quelle ?? c.titel}`
          ))].join(', ')
          controller.enqueue(encoder.encode(`\n\n---\n*Quellen: ${quellen}*`))
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\nFehler: ${e}`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
