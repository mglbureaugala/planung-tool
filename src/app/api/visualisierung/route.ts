export const dynamic = 'force-dynamic'

import { Pool } from 'pg'
import type { BauParam } from '@/lib/bau-types'
import {
  BAUKLASSE_GEBAEUDEHOEHE, BAUKLASSE_GESCHOSSE,
  maxBebauungsgrad, minSeitlicherBauwich,
  bauklasseAusWidmung, parseBebauungsweise,
  WIDMUNG_TEXT, BEBAUUNGSWEISE_TEXT, isBauland,
} from '@/lib/wbo-engine'

// ─── Geocoding ───────────────────────────────────────────────────────────────

async function geocodeAdresse(adresse: string): Promise<{
  lat: number; lng: number; adresse_aufgeloest: string
} | null> {
  const query = /wien/i.test(adresse) ? adresse : `${adresse}, Wien`

  // Primär: Nominatim (OSM)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=at`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'bureau-gala-planung-tool/1.0 (matthias@bureau-gala.at)' },
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data[0]) return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        adresse_aufgeloest: (data[0].display_name as string)
          .replace(/, Österreich$/, '')
          .replace(/,\s*Wien,\s*Wien/, ', Wien'),
      }
    }
  } catch { /* Fallback */ }

  // Fallback: Wien OGD Adressservice
  try {
    const url = `https://data.wien.gv.at/daten/OGDAddressService.svc/GetAddressInfo?CrsName=EPSG:4326&Address=${encodeURIComponent(adresse)}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const data = await res.json()
      const feat = data?.Features?.[0]
      if (feat) {
        const geo = feat.Geometry ?? {}
        const lat = parseFloat(geo.y ?? geo.coordinates?.[1])
        const lng = parseFloat(geo.x ?? geo.coordinates?.[0])
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, adresse_aufgeloest: adresse }
      }
    }
  } catch { /* nichts */ }

  return null
}

// ─── Wien WFS — Flächenwidmungsplan ──────────────────────────────────────────

async function getWidmungAmPunkt(lat: number, lng: number) {
  const delta = 0.0004 // ~40 m
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta},EPSG:4326`

  const url = new URL('https://data.wien.gv.at/daten/geo')
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '1.1.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeName', 'ogdwien:GENFLWIDMUNGOGD')
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('srsName', 'EPSG:4326')
  url.searchParams.set('bbox', bbox)
  url.searchParams.set('maxFeatures', '10')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null

  const data = await res.json()
  const features: Array<{ properties: Record<string, unknown> }> = data?.features ?? []
  if (features.length === 0) return null

  // Kleinste Zonenfläche = spezifischste am Abfragepunkt
  features.sort((a, b) =>
    ((a.properties.FLAECHE as number) ?? Infinity) - ((b.properties.FLAECHE as number) ?? Infinity)
  )

  const p = features[0].properties

  // Wien OGD GENFLWIDMUNGOGD liefert Bebauungsweise in BEBAUUNGSWEISE-Feld,
  // fallback auf WIDMUNG_DETAIL (ältere API-Versionen / manche Layer-Varianten)
  const bebauungsweise_raw =
    (p.BEBAUUNGSWEISE ? String(p.BEBAUUNGSWEISE).trim() : null) ||
    (p.WIDMUNG_DETAIL ? String(p.WIDMUNG_DETAIL).trim() : null) ||
    null

  return {
    widmung: String(p.WIDMUNG ?? '').trim().toUpperCase(),
    bebauungsweise_raw,
    widmung_txt: String(p.WIDMUNG_TXT ?? p.WIDMUNGSKLASSE_TXT ?? p.BEZEICHNUNG ?? '').trim(),
    bezirk: p.BEZIRK ? parseInt(String(p.BEZIRK)) : (p.BEZIRKSNUMMER ? parseInt(String(p.BEZIRKSNUMMER)) : undefined),
  }
}

// ─── Plandokument-Datenbank (optional, nur wenn PLANDOK_DB_URL gesetzt) ──────

let _plandokPool: Pool | null = null
function getPlandokPool(): Pool | null {
  if (!process.env.PLANDOK_DB_URL) return null
  if (!_plandokPool) {
    _plandokPool = new Pool({
      connectionString: process.env.PLANDOK_DB_URL,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    })
  }
  return _plandokPool
}

interface PlandokResult {
  plandok_nr: string
  bezeichnung: string | null
  plan_url: string | null
  text_url: string | null
  bauklasse: string | null
  bebauungsweise: string | null
  max_hoehe_m: number | null
  schutzzone: boolean | null
  besondere_bestimmungen: string[] | null
  baufluchtlinien: boolean | null
}

async function queryPlandokument(lat: number, lng: number): Promise<PlandokResult | null> {
  const pool = getPlandokPool()
  if (!pool) return null

  try {
    const rows = await pool.query<{
      plandok_nummer: string; bezeichnung: string | null
      plan_url: string | null; text_url: string | null
      bauklasse: string | null; bebauungsweise: string | null
      max_hoehe_m: string | null; schutzzone: boolean | null
      besondere_bestimmungen: string[] | null; baufluchtlinien: boolean | null
    }>(`
      SELECT
        p.plandok_nummer, p.bezeichnung,
        pl.source_url  AS plan_url,
        t.source_url   AS text_url,
        pa.bauklasse, pa.bebauungsweise, pa.max_hoehe_m, pa.schutzzone,
        pa.besondere_bestimmungen, pa.baufluchtlinien,
        (pb.bbox_max_lon - pb.bbox_min_lon) * (pb.bbox_max_lat - pb.bbox_min_lat) AS bbox_area
      FROM plandok_bbox pb
      JOIN plandokumente p ON p.plandok_nummer = pb.plandok_nummer
      LEFT JOIN plandokument_pdfs t  ON t.plandok_nummer = p.plandok_nummer AND t.pdf_typ = 'text'
      LEFT JOIN plandokument_pdfs pl ON pl.plandok_nummer = p.plandok_nummer AND pl.pdf_typ = 'plan'
      LEFT JOIN plandok_analyse pa   ON pa.plandok_nummer = p.plandok_nummer
      WHERE $1::numeric BETWEEN pb.bbox_min_lon AND pb.bbox_max_lon
        AND $2::numeric BETWEEN pb.bbox_min_lat AND pb.bbox_max_lat
      ORDER BY bbox_area ASC LIMIT 1
    `, [lng, lat])

    if (rows.rows.length === 0) return null
    const r = rows.rows[0]
    return {
      plandok_nr: r.plandok_nummer,
      bezeichnung: r.bezeichnung,
      plan_url: r.plan_url,
      text_url: r.text_url,
      bauklasse: r.bauklasse,
      bebauungsweise: r.bebauungsweise,
      max_hoehe_m: r.max_hoehe_m ? parseFloat(r.max_hoehe_m) : null,
      schutzzone: r.schutzzone,
      besondere_bestimmungen: r.besondere_bestimmungen,
      baufluchtlinien: r.baufluchtlinien,
    }
  } catch (e) {
    console.error('[visualisierung/plandok]', e)
    return null
  }
}

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json()
  const {
    adresse,
    grundstueck_m2: flaeche_input,
    breite_m: breite_input,
    tiefe_m: tiefe_input,
    bebauungsweise_override,  // Manuelle Überschreibung aus dem Formular
  } = body

  if (!adresse?.trim()) {
    return Response.json({ error: 'Adresse ist erforderlich.' }, { status: 400 })
  }

  // 1. Geocoding
  const coords = await geocodeAdresse(adresse)
  if (!coords) {
    return Response.json({
      error: 'Adresse konnte nicht aufgelöst werden. Bitte eine Wiener Adresse mit Hausnummer und Bezirk eingeben (z. B. „Mariahilfer Straße 100, 1060 Wien").',
    }, { status: 404 })
  }

  // 2. Flächenwidmungsplan (Wien WFS)
  let widmungData: Awaited<ReturnType<typeof getWidmungAmPunkt>> = null
  try {
    widmungData = await getWidmungAmPunkt(coords.lat, coords.lng)
  } catch (e) {
    console.error('[visualisierung/wfs]', e)
  }

  // 3. Plandokument (optional)
  let plandok: PlandokResult | null = null
  try {
    plandok = await queryPlandokument(coords.lat, coords.lng)
  } catch { /* optional */ }

  // ─── Widmungsparameter auflösen ───────────────────────────────────────────

  const widmungCode = widmungData?.widmung ?? ''
  const widmungText = WIDMUNG_TEXT[widmungCode] ?? widmungData?.widmung_txt ?? (widmungCode || 'Unbekannt')

  if (widmungCode && !isBauland(widmungCode)) {
    return Response.json({
      error: `Das Grundstück ist NICHT bebaubar — Widmung: ${widmungText} (${widmungCode}). Bitte eine bebaubare Fläche (Wohngebiet, Gemischtes Baugebiet, …) wählen.`,
      widmung_code: widmungCode,
      widmung_text: widmungText,
      adresse_aufgeloest: coords.adresse_aufgeloest,
      lat: coords.lat,
      lng: coords.lng,
    }, { status: 422 })
  }

  // Bauklasse: Plandokument (präziser) → WFS-Code-Parsing → Fallback
  const bauklasse = (
    plandok?.bauklasse?.trim().toUpperCase() ||
    bauklasseAusWidmung(widmungCode) ||
    'II'
  )

  // Bebauungsweise: Formular-Override → Plandokument → WFS → Bezirk-Standardwert
  // Quellen-Ranking: manuelle Eingabe > Bebauungsplan-Analyse > WFS > Bezirk-Heuristik
  const bwFromSources = (bebauungsweise_override?.trim() || null)
    || (plandok?.bebauungsweise?.trim() || null)
    || parseBebauungsweise(widmungData?.bebauungsweise_raw)
    || null

  // Wien GENFLWIDMUNGOGD liefert KEIN Bebauungsweise-Feld (WIDMUNG_DETAIL ist immer null).
  // Fallback: Bezirk-Heuristik nach typischer Wiener Stadtstruktur:
  //   Bezirk 1–9  → überwiegend geschlossene Bebauungsweise (Gründerzeit, Historismus)
  //   Bezirk 10–23 → überwiegend offene Bebauungsweise (Wohnbauten 20./21. Jh.)
  // Diese Heuristik trifft in > 80 % der Fälle zu; für Genehmigungsplanung
  // ist das Plandokument (MA 21) maßgeblich.
  const bezirkForHeuristic = widmungData?.bezirk
  const bwBezirkDefault: string | null = bezirkForHeuristic != null
    ? (bezirkForHeuristic <= 9 ? 'g' : 'o')
    : null

  const bwRaw = bwFromSources ?? bwBezirkDefault
  const bebauungsweise = bwRaw ?? ''

  const bebauungsweise_text = BEBAUUNGSWEISE_TEXT[bebauungsweise]
    ?? (bebauungsweise.toLowerCase().includes('geschlossen') ? 'geschlossene Bebauungsweise'
      : bebauungsweise.toLowerCase().includes('offen') ? 'offene Bebauungsweise'
      : bebauungsweise.toLowerCase().includes('gekuppelt') ? 'gekuppelte Bebauungsweise'
      : bebauungsweise || 'nicht bestimmt — bitte manuell wählen')

  // Bebauungsweise-Quell-Transparenz
  const bwQuelle = bebauungsweise_override ? 'manuell'
    : plandok?.bebauungsweise ? 'Bebauungsplan'
    : widmungData?.bebauungsweise_raw ? 'Flächenwidmungsplan'
    : bwBezirkDefault ? `Bezirk-Richtwert (${bezirkForHeuristic}. Bezirk)`
    : 'unbekannt'

  // Gebäudehöhe: Plandokument-Analyse → WBO-Standardwert für Bauklasse
  const gebaeudehoehe = plandok?.max_hoehe_m ?? BAUKLASSE_GEBAEUDEHOEHE[bauklasse] ?? 7.5
  const maxGeschosse = BAUKLASSE_GESCHOSSE[bauklasse] ?? 2

  // ─── Grundstücksmaße ─────────────────────────────────────────────────────

  const flaeche = parseFloat(String(flaeche_input)) || 800
  let breite = parseFloat(String(breite_input)) || 0
  let tiefe = parseFloat(String(tiefe_input)) || 0

  if (breite > 0 && tiefe === 0) tiefe = flaeche / breite
  else if (tiefe > 0 && breite === 0) breite = flaeche / tiefe
  else if (breite === 0 && tiefe === 0) {
    // Typisches Wiener Straßenparzellen-Verhältnis
    breite = Math.sqrt(flaeche / 1.6)
    tiefe = flaeche / breite
  }

  breite = Math.round(breite * 10) / 10
  tiefe = Math.round(tiefe * 10) / 10

  // ─── Bauwich §78 WBO Wien ─────────────────────────────────────────────────

  // Normalisierung für Bauwich-Berechnung
  const bwNorm = bebauungsweise.toLowerCase()
  const isGeschlossen = bwNorm === 'g' || bwNorm.startsWith('geschlossen')
    || bwNorm === 'gr' || bwNorm.startsWith('gemischt')  // Gründerzeit = geschlossen an Straße
  const isGekuppelt = bwNorm === 'gk' || bwNorm.startsWith('gekuppelt')
  const isOffen = bwNorm === 'o' || bwNorm.startsWith('offen')
  const isUnbekannt = !bebauungsweise

  let bauwich_s: number
  let bauwich_v: number
  let bauwich_h: number

  if (isGeschlossen) {
    // Geschlossene / Gründerzeit-Bebauungsweise §78 Abs. 1 BO Wien:
    // Kein seitlicher Bauwich, keine Vorgartenzone
    // Hinterer Bauwich: 0 (Bebauungsplan kann Hofzone vorschreiben, aber kein WBO-Standard)
    bauwich_s = 0; bauwich_v = 0; bauwich_h = 0
  } else if (isGekuppelt) {
    // Gekuppelte Bebauungsweise: eine Seite an Grundgrenze, andere Seite § 78
    const bs = minSeitlicherBauwich(bauklasse, gebaeudehoehe, 'o')
    bauwich_s = Math.round(bs / 2 * 10) / 10  // Effektiv: nur eine Seite hat Bauwich
    bauwich_v = 3.0; bauwich_h = 3.0
  } else if (isOffen || isUnbekannt) {
    // Offene Bebauungsweise: seitlicher Bauwich §78 Abs. 2 BO Wien
    bauwich_s = Math.round(minSeitlicherBauwich(bauklasse, gebaeudehoehe, 'o') * 10) / 10
    bauwich_v = 3.0; bauwich_h = 3.0
  } else {
    // Sonstige / dichte Bebauungsweise
    bauwich_s = Math.round(minSeitlicherBauwich(bauklasse, gebaeudehoehe, 'o') * 10) / 10
    bauwich_v = 3.0; bauwich_h = 3.0
  }

  // ─── Baukörper ───────────────────────────────────────────────────────────

  const bk_breite = Math.max(0, Math.round((breite - 2 * bauwich_s) * 10) / 10)
  const bk_tiefe = Math.max(0, Math.round((tiefe - bauwich_v - bauwich_h) * 10) / 10)

  // ─── Bebauungsdichte §79 WBO Wien ────────────────────────────────────────

  const bebauungsgrad = maxBebauungsgrad(bauklasse, bebauungsweise)
  const bebaute_flaeche = Math.round(Math.min(bk_breite * bk_tiefe, flaeche * bebauungsgrad))
  const bgf = Math.round(bebaute_flaeche * maxGeschosse * 0.95)   // 5% Konstruktion
  const ngf = Math.round(bgf * 0.78)                               // NGF-Faktor Wohnen (§79 WBO)

  // Dachform: BKl. I–II typisch Satteldach; III+ Flachdach
  const dachform: 'sattel' | 'flach' = (bauklasse === 'I' || bauklasse === 'II') ? 'sattel' : 'flach'

  // Stellplatzpflicht (§50 BO Wien, vereinfacht: 1 SP je 100 m² NGF Wohnen)
  const stellplaetze = Math.ceil(ngf / 100)

  // ─── Hinweise ────────────────────────────────────────────────────────────

  const hinweise: string[] = []
  if (!widmungCode) hinweise.push('Widmungsabfrage nicht verfügbar — Parameter auf Basis eingegebener Daten berechnet. Flächenwidmungsplan unter www.wien.gv.at/flaechenwidmung/ prüfen.')
  if (plandok) hinweise.push(`Bebauungsplan Nr. ${plandok.plandok_nr} gilt für dieses Grundstück${plandok.bezeichnung ? ' — ' + plandok.bezeichnung : ''}.`)
  if (plandok?.schutzzone) hinweise.push('Schutzzone: Erhaltung der Struktur und des äußeren Erscheinungsbildes ist gesetzlich vorgeschrieben (§2 Z 52 BO Wien). Sanierung statt Abriss.')
  if (plandok?.baufluchtlinien) hinweise.push('Im Bebauungsplan sind Baufluchtlinien festgesetzt — genaue Abstände dem Plan entnehmen.')
  if (plandok?.besondere_bestimmungen?.length) {
    hinweise.push(...plandok.besondere_bestimmungen.slice(0, 3))
  }
  if (!plandok && widmungCode) hinweise.push('Kein analysierter Bebauungsplan verfügbar — WBO-Standardwerte verwendet. Für Genehmigungsplanung Plandokument über MA 21 abrufen.')
  if (bebauungsweise === 'gr') hinweise.push('Gemischte Bebauungsweise (Gründerzeit): Bebauungsweise aus WFS nicht eindeutig. Plandokument prüfen.')

  const optimierungstipps: string[] = [
    ...(maxGeschosse >= 2 ? ['Dachgeschossausbau nach §81 BO Wien möglich — erhöht NGF um ca. 25–40 % ohne Anrechnung auf Bebauungsgrad.'] : []),
    'Technische Aufbauten (Liftschacht, Lüftungsanlage) bis max. 3,0 m über Gebäudehöhe zulässig (§81 Abs. 6 BO Wien).',
    ...(!isGeschlossen ? ['§69 BO Wien: Auf Antrag können Abweichungen vom Bebauungsplan bewilligt werden, wenn das Ortsbild nicht beeinträchtigt wird.'] : []),
    ...(bauklasse === 'I' || bauklasse === 'II' ? ['Keller (§63 BO Wien): Bei Hanglage als Vollgeschoss möglich — erhöht Nutzfläche ohne Anrechnung auf Gebäudehöhe.'] : []),
  ]

  // ─── Rückgabe ─────────────────────────────────────────────────────────────

  // Hinweis zur Bebauungsweise-Quelle
  if (isUnbekannt) {
    hinweise.unshift('Bebauungsweise konnte nicht automatisch bestimmt werden. Bitte im Formular manuell auswählen (Bebauungsplan der MA 21 prüfen).')
  } else if (bwQuelle.startsWith('Bezirk-Richtwert')) {
    hinweise.unshift(`Bebauungsweise: ${bebauungsweise_text} — Schätzwert auf Basis des ${bwQuelle}. Der Flächenwidmungsplan der Wien (GENFLWIDMUNGOGD) enthält kein Bebauungsweise-Feld. Für verbindliche Aussagen Plandokument über MA 21 (www.wien.gv.at/bebauungsplaene) prüfen.`)
  } else {
    hinweise.unshift(`Bebauungsweise: ${bebauungsweise_text} — Quelle: ${bwQuelle}.`)
  }

  const result: BauParam & { bebauungsweise_quelle: string } = {
    adresse: coords.adresse_aufgeloest,
    lat: coords.lat,
    lng: coords.lng,
    grundstueck_m2: flaeche,
    breite_m: breite,
    tiefe_m: tiefe,
    bezirk: widmungData?.bezirk,
    widmung: widmungCode || '—',
    widmung_text: widmungText,
    bebaubar: true,
    bauklasse,
    bebauungsweise,
    bebauungsweise_text,
    bebauungsweise_quelle: bwQuelle,
    plandokument_nr: plandok?.plandok_nr,
    plandokument_url: plandok?.plan_url ?? undefined,
    schutzzone: plandok?.schutzzone ?? false,
    gebaeudehoehe_max_m: gebaeudehoehe,
    max_geschosse: maxGeschosse,
    dachform,
    bauwich_seitlich_m: bauwich_s,
    bauwich_vorne_m: bauwich_v,
    bauwich_hinten_m: bauwich_h,
    baukörper_breite_m: bk_breite,
    baukörper_tiefe_m: bk_tiefe,
    bebauungsgrad,
    bebaute_flaeche_max_m2: bebaute_flaeche,
    bgf_gesamt_m2: bgf,
    ngf_geschaetzt_m2: ngf,
    stellplaetze_pflicht: stellplaetze,
    hinweise,
    optimierungstipps,
  }

  return Response.json(result)
}
