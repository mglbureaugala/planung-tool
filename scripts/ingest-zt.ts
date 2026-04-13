/**
 * ZT Wissenspool – Ingestion Script
 * Verarbeitet PDFs und Excel-Files aus zwei Quellen:
 *   1. ~/Dropbox/Ziviltechnikerpüfung     → ZT-Prüfungsunterlagen
 *   2. ~/Dropbox/Architektur Projekte/000_Normen_Gesetze_OIB → OIB RL 2023 + ÖNORMEN
 *
 * Aufruf: npx tsx scripts/ingest-zt.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL fehlt – .env.local prüfen')
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ── Quellverzeichnisse ────────────────────────────────────────────────────────

const ZT_ROOT = path.resolve(
  process.env.HOME!,
  'Dropbox/Ziviltechnikerpüfung'
)

const NORMEN_ROOT = path.resolve(
  process.env.HOME!,
  'Dropbox/Architektur Projekte/000_Normen_Gesetze_OIB'
)

const CHUNK_SIZE = 1200   // Zeichen pro Chunk
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

// ── ZT-Prüfungsunterlagen: Pfad → Thema ──────────────────────────────────────

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

// ── NORMEN: Dateinamen die KOMPLETT übersprungen werden ───────────────────────
// Gründe: exaktes Duplikat, durch neuere Version ersetzt, kein Normtext
const NORMEN_SKIP = new Set([
  // Exakte Duplikate
  'OENORM_A_6241-1_2015_07_01_DE - Kopie.pdf',
  'ON B 6240_2_TZ_Bauwesen_2 - Kopie.pdf',
  // Alte B-6240-Serie (ersetzt durch A-6240-Serie ab 2009)
  'ON B 6240_1_TZ_Bauwesen_1.pdf',
  'ON B 6240_2_TZ_Bauwesen_2.pdf',
  // Durch "Mein Normenpaket" (April 2026) ersetzt
  'OENORM_B_2608_2014_04_15_Sporthallen.pdf',            // Duplikat in Mein Normenpaket
  'ON EN B_1600_2017_04_01_Barierefreies Bauen.pdf',     // → ÖNORM B 1600:2023
  'ON B 2605 (2008).pdf',                                 // → ÖNORM B 2605:2018
  'ON B 2605.pdf',                                        // → ÖNORM B 2605:2018
  'ON EN 13200-1_Kriterien_für_räumliche_Anordnung 2012.pdf', // → ÖNORM EN 13200-1:2019
  'ON EN 13200-3_Abschrankungen_Anforderungen.pdf',      // → ÖNORM EN 13200-3:2018
  'ON EN 13200-4_Sitze_Produktmerkmale.pdf',             // → ÖNORM EN 13200-4:2023
  'ON EN 13200-5_Ausfahrbare_Tribünen.pdf',              // → ÖNORM EN 13200-5:2006 (final)
  'ON EN 13200-6_Demontierbare_Tribünen_(2013).pdf',     // → ÖNORM EN 13200-6:2020
  'ON EN 13200-7 Entwurf.PDF',                           // Entwurf → ÖNORM EN 13200-7:2014
  'ON EN 15288-1_Schwimmbäder_Sicherheitstechnische Anforderungen an Planung und Bau.pdf',
  'ON V 2102-1.pdf',                                     // → ÖNORM V 2102:2018
  // Ältere Versionen (neuere im selben Ordner vorhanden)
  'ON B 2207 Fliesen-, Platten- und Mosaiklegearbeiten 2007 09 01.pdf', // → ON B 2207.pdf (2014)
  'ON B 1602 2001.pdf',                                  // → ON B 1602 2013
  'On B 3407_Fliesen_ARBEITSENTWURF_Auszug.PDF',         // Entwurf-Auszug → OENORM_B_3407_2019
  'ON B 3407.pdf',                                       // ältere Version → OENORM_B_3407_2019
  'ÖN 1800_Graundflächen und Bauinhalten.pdf',           // alt → ON EN B_1800_2013
  'ON B 1800_Ermittlung von Bauflächenund Rauminhalten von Bauwerken.pdf', // alt → ON EN B_1800_2013_08_01
  'ON B 1801-1_Bauprojekt- und Objektmanagement_Teil1_Objekterrichtung.pdf', // alt → ON EN B_1801-1_2015_12_01
  // OIB: Rev.1 ist aktueller (nicht-Rev.1 überspringen)
  'oib-rl_zitierte_normen_und_sonstige_technische_regelwerke_ausgabe_mai_2023.pdf',
  // Keine Normtexte / Nicht-österreichische Normen
  'Thumbs.db',
  'Brandverhalten ÖN-EN-MA39-Pöhn.pdf',
  'DIN-18202_10_2005-Toleranzen-im-Hochbau.pdf',
  'MA37_ERRICHTUNG VON PHOTOVOLTAIKANLAGEN.pdf',
  'Kundeninformation ÖNORM EN 81-20.pdf',
])

// ── NORMEN: Dateinamen die als VERALTET markiert werden ──────────────────────
// Quelle: Austrian Standards (austrian-standards.at) – geprüft April 2026
// Dokumente bleiben im Wissenspool (historische Information), werden aber
// aus Chat- und Suchergebnissen gefiltert.
const NORMEN_VERALTET = new Set([
  // Technische Zeichnungen / BIM
  'OENORM_A_6240-1_2009_08_01_technische Zeichnungen für das Bauwesen.pdf', // aktuell: 2018-04-15
  'OENORM_A_6240-2_2009_08_01_DE.pdf',           // aktuell: 2025-10-15
  'OENORM_A_6241-1_2015_07_01_DE.pdf',           // ZURÜCKGEZOGEN – aktuell: 2025-10-15
  // Bauverträge
  'ON B 2110_Allgemeine Vertragsbestimmungen für Bauleistungen.pdf',          // aktuell: 2023-05-01
  // Treppen / Geländer
  'ON B 5371_Treppen_Geländer_Brüstungen_in Gebäuden und von Außenanlagen_Abmessungen.pdf', // aktuell: 2021-03-01
  // Brandschutz
  'ON EN 13501-1.pdf',                           // aktuell: ÖNORM EN 13501-1:2020-01-15
  'ON B 3800-4.pdf',                             // ÖNORM B 3800-Reihe: aktuell B 3800-5:2024-01-15
  // Schallschutz
  'OENORM_B_8115-2_2006_12_01_de.pdf',           // aktuell: 2021-04-15
  // Elektrotechnik / Blitzschutz
  'I_26_OeVE_OeNORM_E_8002-1_2007-10-01.pdf',   // ÖVE/ÖNORM E 8002-1:2007
  'ON E 8049_1_Blitzschutz_baulicher_Anlagen_Teil1_AllgemeineGrundsätze.pdf', // 2012
  // TRVB (1998)
  'TRVB B 109 98-Brennbarkeit.pdf',
  // Spielplatz – prEN Vornormen, zurückgezogen durch EN 1176:2024-Reihe
  'prEN 1176-1_d_stf (01-2008).pdf',             // → ÖNORM EN 1176-1:2024-05-15
  'prEN1176-10_d_umschl Geräte.pdf',             // → ÖNORM EN 1176-10:2024-04-15
  'prEN1176-11_d_Raumnetze.pdf',
  'prEN1176-2 Schaukel.pdf',
  'prEN1176-3 Rutsche.pdf',
  'prEN1176-4_d_Seilbahn.pdf',
  'prEN1176-5_d_Karussell.pdf',
  'prEN1176-6_d_Wippgeräte.pdf',
  'prEN1176-7_d_Inspektion.pdf',
  'prEN1177_d_Prüf Fallsch.pdf',
  'ÖNORM B 2607 (2014).pdf',                     // → ÖNORM B 2607:2024-05-01
  // Sehr alte Normen (vor 2004)
  'OENORM_EN_12197_1997_09_01_de.pdf',
  'OENORM_EN_12346_1998_09_01_de.pdf',
  'OENORM_EN_12655_1998_11_01_de.pdf',
  'OENORM_S_4616_1991_06_01_de.pdf',
  'OENORM_S_4622_1999_12_01_de.pdf',
  'OENORM_S_4634_2003_06_01_de.pdf',
  'OENORM_S_4701_1999_04_01_de.pdf',
  'OENORM_S_4703_1999_07_01_de.pdf',
  'OENORM_S_4706_2000_04_01_de.pdf',
  'OENORM_S_4708_2000_12_01_de.pdf',
])

// ── Thema-Auflösung für ZT-Prüfungsunterlagen ────────────────────────────────

function resolveThema(filePath: string): ZtThema | null {
  const rel = path.relative(ZT_ROOT, filePath).replace(/\\/g, '/')

  const skip = [
    '00_Übermittlung', 'Befugnisansuchen', 'Zeugnisse', 'Vereidigung',
    'VDA_', 'Lebenslauf', 'Siegelentwurf', 'Termineinteilung',
    'Prüfungseinteilung', 'Teilnahmebestätigung', 'Bestellformular',
    'BEFAEHIGUNGSNACHWEIS', 'PRAXISZEUGNIS', 'ZT-Kurs Programm',
    'ztakademie_ZT-Kurs', 'FAQ ZT Kurs', 'FORMULAR_ANTRAG',
    '__MACOSX', 'Transaktion',
  ]
  if (skip.some(s => rel.includes(s))) return null

  for (const { prefix, thema } of PATH_TO_THEMA) {
    if (rel.startsWith(prefix) || rel.includes(prefix)) return thema
  }
  return null
}

// ── Quelle-Label für ZT-Prüfungsunterlagen ───────────────────────────────────

function extractQuelle(filePath: string): string {
  const parts = path.relative(ZT_ROOT, filePath).split(path.sep)
  for (let i = parts.length - 2; i >= 0; i--) {
    const p = parts[i]
    if (![
      'Skripten', 'A-F', 'G-H', 'K-L', 'M-P', 'S-Z',
      'Unterlagensammlung Extern', 'Future ZT - Unterlagen',
      'Simlinger 2020 - Büroorganisation + BWL',
      'Simlinger 2020 - Bu\u0308roorganisation + BWL',
      'wetransfer_zt-sammlung_2023-09-25_1140',
      'zwischenstandthemenstrukturfragenantworten',
      'Eigene Beispiele', 'VO1', 'VO2', 'VO3', 'Literatur_V-X',
    ].includes(p)) {
      return p
    }
  }
  return parts[0] || ''
}

// ── Thema-Auflösung für NORMEN ────────────────────────────────────────────────

function resolveNormenThema(filePath: string): ZtThema | null {
  const ext = path.extname(filePath).toLowerCase()
  if (ext !== '.pdf') return null

  // NFC-Normalisierung: macOS speichert Umlaute in NFD
  const basename = path.basename(filePath).normalize('NFC')
  if (NORMEN_SKIP.has(basename)) return null

  // NFC-Normalisierung: macOS speichert Umlaute in NFD (O + U+0308)
  const rel = path.relative(NORMEN_ROOT, filePath).replace(/\\/g, '/').normalize('NFC')
  if (rel.startsWith('OIB RL') || rel.startsWith('\u00d6NORMEN')) {
    return 'OIB_RICHTLINIEN'
  }
  return null
}

// ── Quelle-Label für NORMEN ───────────────────────────────────────────────────

function extractNormenQuelle(filePath: string): string {
  const base = path.basename(filePath)
  const noExt = base.replace(/\.[^.]+$/, '').trim()
  const lower = noExt.toLowerCase()

  // OIB Richtlinien
  if (lower.includes('oib')) {
    if (lower.includes('begriffsbestimmungen')) return 'OIB RL \u2013 Begriffsbestimmungen (2023)'
    if (lower.includes('zitierte')) return 'OIB RL \u2013 Zitierte Normen (2023 Rev.1)'
    const numMatch = lower.match(/oib[-_]rl[-_]([\d]+(?:[._][\d]+)?)/)
    const nr = numMatch ? numMatch[1].replace('_', '.') : '?'
    if (lower.startsWith('erlaeuterungen')) return `OIB RL ${nr} \u2013 Erl\u00e4uterungen (2023)`
    if (lower.startsWith('aenderungen'))    return `OIB RL ${nr} \u2013 \u00c4nderungen (2023)`
    if (lower.includes('leitfaden'))        return `OIB RL ${nr} \u2013 Leitfaden (2023)`
    return `OIB RL ${nr} (2023)`
  }

  // prEN Vornormen
  if (lower.startsWith('pren')) {
    const numMatch = noExt.match(/prEN\s*([\d-]+)/i)
    return numMatch
      ? `prEN ${numMatch[1]} \u2013 Vornorm (zur\u00fcckgezogen)`
      : 'prEN \u2013 Vornorm (zur\u00fcckgezogen)'
  }

  // TRVB
  if (lower.startsWith('trvb')) return 'TRVB'

  // ÖNORM literal prefix
  const oenormLiteralMatch = noExt.match(/^\u00d6NORM\s+([A-Z]+)\s+([\d-]+)/i)
  if (oenormLiteralMatch) {
    const yearMatch = noExt.match(/\((\d{4})\)/)
    const year = yearMatch ? ` (${yearMatch[1]})` : ''
    return `\u00d6NORM ${oenormLiteralMatch[1].toUpperCase()} ${oenormLiteralMatch[2]}${year}`
  }

  // Modern OENORM: OENORM_{SERIES}_{NUMBER}_{YEAR}
  const modernMatch = noExt.match(/^OENORM_([A-Z]+)_([\dA-Z-]+)(?:_|\s)(\d{4})/i)
  if (modernMatch) {
    return `\u00d6NORM ${modernMatch[1].toUpperCase()} ${modernMatch[2]} (${modernMatch[3]})`
  }

  // OENORM with space: OENORM_{SERIES} {NUMBER}
  const modernSpaceMatch = noExt.match(/^OENORM_([A-Z]+)\s+([\d-]+)/i)
  if (modernSpaceMatch) {
    const yearMatch = noExt.match(/(\d{4})/)
    const year = yearMatch ? ` (${yearMatch[1]})` : ''
    return `\u00d6NORM ${modernSpaceMatch[1].toUpperCase()} ${modernSpaceMatch[2]}${year}`
  }

  // ON EN {SERIES}_{NUMBER}_{YEAR}: e.g. "ON EN B_1800_2013_08_01"
  const onEnSeriesMatch = noExt.match(/^ON\s+[A-Z]+\s+([A-Z]+)_([\dA-Z-]+)_(\d{4})/i)
  if (onEnSeriesMatch) {
    return `\u00d6NORM ${onEnSeriesMatch[1].toUpperCase()} ${onEnSeriesMatch[2].split('_')[0]} (${onEnSeriesMatch[3]})`
  }

  // ON {SERIES} {NUMBER}: e.g. "ON B 2110_...", "On B 1601_..."
  const onMatch = noExt.match(/^ON\s+([A-Z]+)\s+([\d-]+)/i)
  if (onMatch) {
    const yearMatch = noExt.match(/_(\d{4})_/)
    const year = yearMatch ? ` (${yearMatch[1]})` : ''
    return `\u00d6NORM ${onMatch[1].toUpperCase()} ${onMatch[2]}${year}`
  }

  // ÖVE/ÖNORM
  if (lower.includes('oevenorm') || lower.includes('oeve')) return '\u00d6VE/\u00d6NORM'

  // Fallback
  return noExt.replace(/_/g, ' ').replace(/\s+/g, ' ').substring(0, 60)
}

// ── Text-Extraktion ───────────────────────────────────────────────────────────

function cleanText(text: string): string {
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

// ── Datei ingesten ────────────────────────────────────────────────────────────

async function ingestFile(
  filePath: string,
  overrides: { thema?: ZtThema; quelle?: string; veraltet?: boolean } = {}
) {
  const thema = overrides.thema ?? resolveThema(filePath)
  if (!thema) return

  const ext = path.extname(filePath).toLowerCase()
  if (!['.pdf', '.xlsx', '.xls'].includes(ext)) return

  const existing = await prisma.ztDocument.findUnique({ where: { pfad: filePath } })
  if (existing) {
    // Veraltet-Flag aktualisieren wenn nötig (Re-Run)
    if (overrides.veraltet !== undefined && existing.veraltet !== overrides.veraltet) {
      await prisma.ztDocument.update({
        where: { id: existing.id },
        data: { veraltet: overrides.veraltet },
      })
      process.stdout.write(`  \u21bb veraltet-Flag aktualisiert: ${path.basename(filePath)}\n`)
    } else {
      process.stdout.write(`  \u21a9 bereits vorhanden: ${path.basename(filePath)}\n`)
    }
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
    process.stdout.write(`  \u2717 Fehler bei ${path.basename(filePath)}: ${e}\n`)
    return
  }

  if (!rawText.trim()) {
    process.stdout.write(`  \u2717 Kein Text: ${path.basename(filePath)}\n`)
    return
  }

  const quelle = overrides.quelle ?? extractQuelle(filePath)
  const titel = path.basename(filePath, ext)
  const veraltet = overrides.veraltet ?? false

  const doc = await prisma.ztDocument.create({
    data: { titel, dateiname: path.basename(filePath), pfad: filePath, thema, quelle, veraltet },
  })

  const chunks = chunkText(rawText)
  await prisma.ztChunk.createMany({
    data: chunks.map((text, i) => ({ documentId: doc.id, seite: i + 1, text })),
  })

  const veraltetLabel = veraltet ? ' [VERALTET]' : ''
  process.stdout.write(`  \u2713 [${thema}]${veraltetLabel} ${quelle} (${chunks.length} Chunks)\n`)
}

// ── Dateien sammeln ───────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('ZT Wissenspool \u2013 Ingestion\n')

  // PostgreSQL Full-Text Search Index einrichten (idempotent)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS zt_chunks_fts_idx
    ON zt_chunks USING GIN (to_tsvector('german', text))
  `)

  // ── 1. ZT-Prüfungsunterlagen ─────────────────────────────────────────────
  if (fs.existsSync(ZT_ROOT)) {
    console.log(`\n\u2500\u2500 ZT-Pr\u00fcfungsunterlagen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`)
    console.log(`Quelle: ${ZT_ROOT}\n`)
    const ztFiles = collectFiles(ZT_ROOT)
    console.log(`Gefundene Dateien: ${ztFiles.length}\n`)
    for (const f of ztFiles) {
      await ingestFile(f)
    }
  } else {
    console.log(`\u26a0 ZT_ROOT nicht gefunden: ${ZT_ROOT}`)
  }

  // ── 2. OIB Richtlinien + ÖNORMEN ─────────────────────────────────────────
  if (fs.existsSync(NORMEN_ROOT)) {
    console.log(`\n\u2500\u2500 OIB Richtlinien & \u00d6NORMEN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`)
    console.log(`Quelle: ${NORMEN_ROOT}\n`)
    const normenFiles = collectFiles(NORMEN_ROOT)
    console.log(`Gefundene Dateien: ${normenFiles.length}\n`)

    let skipped = 0
    let veraltetCount = 0

    for (const f of normenFiles) {
      // NFC-Normalisierung: macOS speichert Umlaute in NFD
      const basename = path.basename(f).normalize('NFC')
      const ext = path.extname(f).toLowerCase()

      if (ext !== '.pdf') continue

      if (NORMEN_SKIP.has(basename)) {
        process.stdout.write(`  \u229d \u00fcbersprungen (ersetzt/redundant): ${basename}\n`)
        skipped++
        continue
      }

      const thema = resolveNormenThema(f)
      if (!thema) continue

      const quelle = extractNormenQuelle(f)
      const veraltet = NORMEN_VERALTET.has(basename)
      if (veraltet) veraltetCount++

      await ingestFile(f, { thema, quelle, veraltet })
    }

    console.log(`\nNormen: ${skipped} \u00fcbersprungen, ${veraltetCount} als veraltet markiert`)
  } else {
    console.log(`\u26a0 NORMEN_ROOT nicht gefunden: ${NORMEN_ROOT}`)
  }

  // ── Statistik ─────────────────────────────────────────────────────────────
  const docCount    = await prisma.ztDocument.count()
  const veraltetTotal = await prisma.ztDocument.count({ where: { veraltet: true } })
  const chunkCount  = await prisma.ztChunk.count()
  console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`)
  console.log(`Fertig: ${docCount} Dokumente (davon ${veraltetTotal} veraltet), ${chunkCount} Chunks`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
