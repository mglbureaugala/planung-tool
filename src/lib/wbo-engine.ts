/**
 * Wiener Bauordnung (BO Wien) Regel-Engine
 * Werte aus BO Wien LGBl. Nr. 11/1930 idgF., §§75–81
 *
 * Kompatibel mit pe-tool/src/lib/baurecht/wbo-engine.ts
 */

// §76 WBO: Max. Gebäudehöhe je Bauklasse
// Gebäudehöhe = Maß vom Fußboden des untersten Hauptgeschosses
// bis zur Traufenlinie (Gesimshöhe) — §75 Abs. 1 BO Wien
export const BAUKLASSE_GEBAEUDEHOEHE: Record<string, number> = {
  I:   4.5,   // EG, typ. eingeschossig
  II:  7.5,   // 2 Hauptgeschosse
  III: 10.5,  // 3 Hauptgeschosse
  IV:  16.0,  // bis 5 Geschosse
  V:   26.0,  // bis 8 Geschosse
  VI:  -1,    // Hochhauszone, gesonderte Sonderflächenwidmung
}

// Abgeleitete Geschosszahl je Bauklasse
export const BAUKLASSE_GESCHOSSE: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 5, V: 8, VI: 99,
}

// §79 WBO: Max. Bebauungsgrad (bebaute Fläche / Grundstücksfläche)
export function maxBebauungsgrad(
  bauklasse: string,
  bebauungsweise: string,
): number {
  const bw = bebauungsweise.toLowerCase()
  if (bw === 'g' || bw === 'geschlossen') return 0.90
  if (bw === 'gk' || bw === 'gekuppelt') return 0.65
  if (bw === 'o' || bw === 'offen') {
    return bauklasse === 'I' || bauklasse === 'II' ? 0.50 : 0.60
  }
  // gemischt/gr/Gründerzeit/default
  return 0.60
}

// §78 WBO: Min. seitlicher Bauwich
// offene/gekuppelte Bauweise: max(h/2, Mindestbauwich)
// Mindestbauwich: 3 m für BKl. I–III, 6 m für BKl. IV–V
export function minSeitlicherBauwich(
  bauklasse: string,
  gebaeudehoehe: number,
  bebauungsweise: string,
): number {
  const bw = bebauungsweise.toLowerCase()
  if (bw === 'g' || bw === 'geschlossen') return 0
  const mindest = bauklasse === 'IV' || bauklasse === 'V' ? 6 : 3
  return Math.max(gebaeudehoehe / 2, mindest)
}

// Bauklasse-Ziffer aus Widmungskürzel extrahieren
// "W2" → "II", "GB3" → "III", "W2+" → "II"
export function bauklasseAusWidmung(widmung: string): string | null {
  const match = widmung.trim().match(/(\d+)\+?$/)
  if (!match) return null
  const map: Record<string, string> = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI',
  }
  return map[match[1]] ?? null
}

// Bebauungsweise aus WIDMUNG_DETAIL / BEBAUUNGSWEISE-Feld parsen
export function parseBebauungsweise(detail: string | null | undefined): string {
  if (!detail) return ''
  const d = detail.toLowerCase().trim()
  if (d === 'g' || d.includes('geschlossen')) return 'g'
  if (d === 'gk' || d.includes('gekuppelt')) return 'gk'
  if (d === 'o' || d.includes('offen')) return 'o'
  if (d === 'gr' || d.includes('gemischt') || d.includes('gründerzeit')) return 'gr'
  if (d === 'd' || d.includes('dicht')) return 'd'
  return ''
}

// Bauland-Check (positive Liste, verifiziert via Wien OGD GENFLWIDMUNGOGD)
const BAULAND_PREFIXES = ['W', 'GB', 'BB', 'IG', 'SO']
export function isBauland(widmung: string): boolean {
  if (!widmung) return false
  const w = widmung.trim().toUpperCase()
  return BAULAND_PREFIXES.some(p => w.startsWith(p))
}

// Widmungskürzel → Langtext (MA 21, Stand 2024)
export const WIDMUNG_TEXT: Record<string, string> = {
  W: 'Wohngebiet', W1: 'Wohngebiet BKl. I', W2: 'Wohngebiet BKl. II',
  W3: 'Wohngebiet BKl. III', W4: 'Wohngebiet BKl. IV', W5: 'Wohngebiet BKl. V',
  WGV1: 'Wohngebiet mit Geschäftsviertel BKl. I', WGV2: 'Wohngebiet mit Geschäftsviertel BKl. II',
  WGV3: 'Wohngebiet mit Geschäftsviertel BKl. III', WGV4: 'Wohngebiet mit Geschäftsviertel BKl. IV',
  GB: 'Gemischtes Baugebiet', GB1: 'Gemischtes Baugebiet BKl. I',
  GB2: 'Gemischtes Baugebiet BKl. II', GB3: 'Gemischtes Baugebiet BKl. III',
  GB4: 'Gemischtes Baugebiet BKl. IV', GB5: 'Gemischtes Baugebiet BKl. V',
  GBBG1: 'Gem. Baugebiet mit Begrünung BKl. I', GBBG2: 'Gem. Baugebiet mit Begrünung BKl. II',
  GBBG3: 'Gem. Baugebiet mit Begrünung BKl. III',
  BB: 'Besonderes Baugebiet', IG: 'Industriegebiet', SO: 'Sondergebiet',
  G: 'Grünland', GF: 'Grünland — Freihaltefläche', GH: 'Grünland — Hausgärten',
  GK: 'Grünland — Kleingartenanlage', GKL: 'Grünland — Kleingärten (Lauben)',
  GKS: 'Grünland — Kleingärten (saisonal)', GE: 'Grünland — Erholungsgebiet',
  GWS: 'Grünland — Wald-/Wiesenschutzgebiet', GFW: 'Grünland — Forst-/Waldgebiet',
  GSP: 'Grünland — Sportanlage/Parkanlage',
  E: 'Erholungsfläche', EPK: 'Erholungsfläche — Parkanlage', F: 'Forstgebiet',
  L: 'Landwirtschaftliche Nutzfläche',
  V: 'Verkehrsfläche', VB: 'Verkehrsfläche — Bahnanlage',
  OE: 'Öffentliche Einrichtung',
}

// Bebauungsweise-Kürzel → Langtext
export const BEBAUUNGSWEISE_TEXT: Record<string, string> = {
  o:   'offene Bebauungsweise',
  g:   'geschlossene Bebauungsweise',
  gk:  'gekuppelte Bebauungsweise',
  gr:  'gemischte Bebauungsweise (Gründerzeit)',
  d:   'dichte Bebauungsweise',
  so:  'Sonder-Bebauungsweise',
}
