/**
 * ZT Wissenspool – Ingestion Script
 * Verarbeitet PDFs und Excel-Files aus dem Dropbox-Ordner und speichert
 * Textchunks in der PostgreSQL-Datenbank.
 *
 * Aufruf: npx tsx scripts/ingest-zt.ts
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')

const prisma = new PrismaClient()

const DROPBOX_ROOT = path.resolve(
  process.env.HOME!,
  'Dropbox/Ziviltechnikerpüfung'
)

const CHUNK_SIZE = 1200  // Zeichen pro Chunk
const CHUNK_OVERLAP = 150

type ZtThema =
  | 'BERUFSRECHT'
  | 'HAFTUNG'
  | 'WIENER_BAUORDNUNG'
  | 'BAURECHT_WIEN'
  | 'OIB_RICHTLINIEN'
  | 'VERGABERECHT'
  | 'RAUMPLANUNG'
  | 'GRUNDBUCHSRECHT'
  | 'VERWALTUNGSRECHT'
  | 'BWL'
  | 'SOZIALE_ABSICHERUNG'

// Pfad-Präfix → Thema (Reihenfolge: spezifischer zuerst)
const PATH_TO_THEMA: Array<{ prefix: string; thema: ZtThema }> = [
  // Haftung
  { prefix: 'Skripten/01_Berufsrecht/1.5_Haftung', thema: 'HAFTUNG' },
  { prefix: 'Skripten/G-H/Girardi', thema: 'HAFTUNG' },
  { prefix: 'Skripten/A-F/Artmann', thema: 'HAFTUNG' },

  // Berufsrecht
  { prefix: 'Skripten/01_Berufsrecht', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/S-Z/Tanzer', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/K-L/Karl', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/Unterlagensammlung Extern/zwischenstandthemenstrukturfragenantworten', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/Unterlagensammlung Extern/1_BERUFSRECHT', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/Unterlagensammlung Extern/Future ZT - Unterlagen/Future ZT - Unterlagen/Prüfungsfragen Berufsrecht', thema: 'BERUFSRECHT' },

  // OIB Richtlinien (vor allgemeinem Baurecht, da spezifischer)
  { prefix: 'Skripten/M-P/Markouschek', thema: 'OIB_RICHTLINIEN' },

  // Baurecht Wien – praktische Anwendung & Novellen
  { prefix: 'Skripten/K-L/Landrock', thema: 'BAURECHT_WIEN' },
  { prefix: 'Skripten/K-L/Länger', thema: 'BAURECHT_WIEN' },
  { prefix: 'Skripten/Unterlagensammlung Extern/merkblatt-gs', thema: 'BAURECHT_WIEN' },
  { prefix: 'Skripten/Unterlagensammlung Extern/gebaeudehoehenberechnung', thema: 'BAURECHT_WIEN' },
  { prefix: 'Skripten/Unterlagensammlung Extern/leitfaden-69-bo', thema: 'BAURECHT_WIEN' },
  { prefix: 'Skripten/Unterlagensammlung Extern/legende-flwbpl', thema: 'BAURECHT_WIEN' },
  { prefix: 'Skripten/Unterlagensammlung Extern/Rettungswege', thema: 'BAURECHT_WIEN' },

  // Wiener Bauordnung – §§ und Skripten
  { prefix: 'Wiener Bauordnung Fassung 2022', thema: 'WIENER_BAUORDNUNG' },
  { prefix: 'Skripten/K-L/Leithner', thema: 'WIENER_BAUORDNUNG' },
  { prefix: 'Skripten/K-L/Kaufmann', thema: 'WIENER_BAUORDNUNG' },
  { prefix: 'Skripten/Unterlagensammlung Extern/wetransfer_zt-sammlung', thema: 'WIENER_BAUORDNUNG' },
  { prefix: 'Skripten/Unterlagensammlung Extern/Future ZT - Unterlagen/Future ZT - Unterlagen/Fachgebiet_BO', thema: 'WIENER_BAUORDNUNG' },
  { prefix: 'Skripten/Unterlagensammlung Extern/Future ZT - Unterlagen/Future ZT - Unterlagen/Inhalt WBO', thema: 'WIENER_BAUORDNUNG' },
  { prefix: 'Skripten/Unterlagensammlung Extern/Future ZT - Unterlagen/Future ZT - Unterlagen/Tabelle_Baubewilligungsverfahren', thema: 'WIENER_BAUORDNUNG' },

  // Vergaberecht & Normenwesen
  { prefix: 'Skripten/A-F/Fink', thema: 'VERGABERECHT' },

  // Raumplanung
  { prefix: 'Skripten/G-H/Hrdliczka', thema: 'RAUMPLANUNG' },

  // Grundbuchsrecht
  { prefix: 'Skripten/A-F/Berchtold', thema: 'GRUNDBUCHSRECHT' },

  // Verwaltungsrecht
  { prefix: 'Skripten/A-F/Eisler', thema: 'VERWALTUNGSRECHT' },
  { prefix: 'Skripten/S-Z/Streimelweger', thema: 'VERWALTUNGSRECHT' },
  { prefix: 'Verfassungs und Verwaltungsrecht', thema: 'VERWALTUNGSRECHT' },

  // BWL
  { prefix: 'BWL', thema: 'BWL' },
  { prefix: 'Skripten/S-Z/Reschny', thema: 'BWL' },
  { prefix: 'Skripten/Unterlagensammlung Extern/Simlinger', thema: 'BWL' },

  // Soziale Absicherung
  { prefix: 'Skripten/S-Z/Taudes', thema: 'SOZIALE_ABSICHERUNG' },

  // Prüfungsfragen → Berufsrecht als Fallback
  { prefix: 'Skripten/Sammlung Prüfungsfragen', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/G-H/Gutternigh', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/G-H/Guggenbichler', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/G-H/Huber', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/K-L/Karner', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/K-L/Klein', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/M-P/Neuhold', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/M-P/Priebernig', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/S-Z/Stracke', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/A-F/Eder', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/S-Z/Zabini', thema: 'BERUFSRECHT' },
  { prefix: 'Skripten/Unterlagensammlung Extern/Future ZT - Unterlagen', thema: 'BERUFSRECHT' },
]

function resolveThema(filePath: string): ZtThema | null {
  // Relativer Pfad ab DROPBOX_ROOT
  const rel = path.relative(DROPBOX_ROOT, filePath).replace(/\\/g, '/')

  // Persönliche Unterlagen überspringen
  const skip = [
    '00_Übermittlung',
    'Befugnisansuchen',
    'Zeugnisse',
    'Vereidigung',
    'VDA_',
    'Lebenslauf',
    'Siegelentwurf',
    'Termineinteilung',
    'Prüfungseinteilung',
    'Teilnahmebestätigung',
    'Bestellformular',
    'BEFAEHIGUNGSNACHWEIS',
    'PRAXISZEUGNIS',
    'ZT-Kurs Programm',
    'ztakademie_ZT-Kurs',
    'FAQ ZT Kurs',
    'FORMULAR_ANTRAG',
    '__MACOSX',
    'Transaktion',
  ]
  if (skip.some(s => rel.includes(s))) return null

  for (const { prefix, thema } of PATH_TO_THEMA) {
    if (rel.startsWith(prefix) || rel.includes(prefix)) return thema
  }

  return null
}

function extractQuelle(filePath: string): string {
  const parts = path.relative(DROPBOX_ROOT, filePath).split(path.sep)
  // Letztes aussagekräftiges Verzeichnis
  for (let i = parts.length - 2; i >= 0; i--) {
    const p = parts[i]
    if (!['Skripten', 'A-F', 'G-H', 'K-L', 'M-P', 'S-Z', 'Unterlagensammlung Extern',
           'Future ZT - Unterlagen', 'Simlinger 2020 - Büroorganisation + BWL',
           'Simlinger 2020 - Bu╠êroorganisation + BWL', 'wetransfer_zt-sammlung_2023-09-25_1140',
           'zwischenstandthemenstrukturfragenantworten', 'Eigene Beispiele', 'VO1', 'VO2', 'VO3',
           'Literatur_V-X',
    ].includes(p)) {
      return p
    }
  }
  return parts[0] || ''
}

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end).trim())
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks.filter(c => c.length > 100)
}

function cleanText(text: string): string {
  // Null-Bytes und andere ungültige UTF8-Sequenzen entfernen
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
}

async function extractPdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  return cleanText(data.text || '')
}

function extractXlsx(filePath: string): string {
  const wb = XLSX.readFile(filePath)
  const texts: string[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    texts.push(`=== ${sheetName} ===\n${csv}`)
  }
  return texts.join('\n\n')
}

async function ingestFile(filePath: string) {
  const thema = resolveThema(filePath)
  if (!thema) return

  const ext = path.extname(filePath).toLowerCase()
  if (!['.pdf', '.xlsx', '.xls'].includes(ext)) return

  // Bereits verarbeitet?
  const existing = await prisma.ztDocument.findUnique({ where: { pfad: filePath } })
  if (existing) {
    process.stdout.write(`  ↩ bereits vorhanden: ${path.basename(filePath)}\n`)
    return
  }

  let rawText = ''
  try {
    if (ext === '.pdf') {
      rawText = await extractPdf(filePath)
    } else {
      rawText = extractXlsx(filePath)
    }
  } catch (e) {
    process.stdout.write(`  ✗ Fehler bei ${path.basename(filePath)}: ${e}\n`)
    return
  }

  if (!rawText.trim()) {
    process.stdout.write(`  ✗ Kein Text: ${path.basename(filePath)}\n`)
    return
  }

  const quelle = extractQuelle(filePath)
  const titel = path.basename(filePath, ext)

  const doc = await prisma.ztDocument.create({
    data: { titel, dateiname: path.basename(filePath), pfad: filePath, thema, quelle },
  })

  const chunks = chunkText(rawText)
  await prisma.ztChunk.createMany({
    data: chunks.map((text, i) => ({ documentId: doc.id, seite: i + 1, text })),
  })

  process.stdout.write(`  ✓ [${thema}] ${titel} (${chunks.length} Chunks)\n`)
}

function collectFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectFiles(full))
    } else {
      results.push(full)
    }
  }
  return results
}

async function main() {
  console.log('ZT Wissenspool – Ingestion\n')
  console.log(`Quelle: ${DROPBOX_ROOT}\n`)

  // PostgreSQL Full-Text Search Index einrichten (idempotent)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS zt_chunks_fts_idx
    ON zt_chunks USING GIN (to_tsvector('german', text))
  `)

  const files = collectFiles(DROPBOX_ROOT)
  console.log(`Gefundene Dateien: ${files.length}\n`)

  for (const f of files) {
    await ingestFile(f)
  }

  const docCount = await prisma.ztDocument.count()
  const chunkCount = await prisma.ztChunk.count()
  console.log(`\nFertig: ${docCount} Dokumente, ${chunkCount} Chunks`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
