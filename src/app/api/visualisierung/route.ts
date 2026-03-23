export const dynamic = 'force-dynamic'

import { Pool } from 'pg'
import type { BauParam } from '@/lib/bau-types'
import {
  BAUKLASSE_GEBAEUDEHOEHE, BAUKLASSE_GESCHOSSE,
  maxBebauungsgrad, minSeitlicherBauwich,
  bauklasseAusWidmung, parseBebauungsweise,
  WIDMUNG_TEXT, BEBAUUNGSWEISE_TEXT, isBauland,
} from '@/lib/wbo-engine'

// ─── Geocoding ────────────────────────────────────────────────────────────────

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

  return {
    widmung: String(p.WIDMUNG ?? '').trim().toUpperCase(),
    // WIDMUNG_DETAIL ist im Wien OGD GENFLWIDMUNGOGD-Layer immer null —
    // Bebauungsweise ist nur über Plandokumente (MA 21) verfügbar.
    widmung_txt: String(p.WIDMUNG_TXT ?? p.WIDMUNGSKLASSE_TXT ?? p.BEZEICHNUNG ?? '').trim(),
    bezirk: p.BEZIRK ? parseInt(String(p.BEZIRK)) : undefined,
  }
}

// ─── BEV Kataster (DKM — Digitale Katastralmappe, täglich aktualisiert) ──────
// Flow: BEV WMS GetFeatureInfo → inspireId → parse KG/GNr → BEV gst API
// Datenquelle: BEV (Bundesamt für Eich- und Vermessungswesen), open data

interface KatasterResult {
  kg: string
  gnr: string
  ez?: string
  grundstueck_m2: number        // Summe aller Nutzungsflächen
  breite_m: number              // Bounding-Box Breite (physikalisch)
  tiefe_m: number               // Bounding-Box Tiefe
  parcel_polygon: [number, number][]  // [lng, lat] Koordinaten
}

async function getKatasterParcel(lat: number, lng: number): Promise<KatasterResult | null> {
  try {
    // 1. BEV WMS GetFeatureInfo — EPSG:4326 Achsenreihenfolge: LAT,LNG (WMS 1.3.0!)
    const delta = 0.0008
    const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`
    const wmsUrl = `https://data.bev.gv.at/geoserver/INSdataCP/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=CP_CadastralParcel&QUERY_LAYERS=CP_CadastralParcel&INFO_FORMAT=application/json&BBOX=${bbox}&CRS=EPSG:4326&WIDTH=400&HEIGHT=400&I=200&J=200&FEATURE_COUNT=5`

    const wmsRes = await fetch(wmsUrl, { signal: AbortSignal.timeout(6000) })
    if (!wmsRes.ok) return null
    const wmsData = await wmsRes.json()
    const features = wmsData?.features ?? []
    if (features.length === 0) return null

    // Kleinstes Feature = spezifischste Parzelle am Abfragepunkt
    const feat = features[0]
    const inspireId: string = feat.properties?.inspireId ?? ''

    // 2. inspireId parsen: AT.0002.I.6.CP.{KG5}{GNR}[#{N}]
    const cpMatch = inspireId.match(/CP\.(\d{5})(\d+)(?:#\d+)?$/)
    if (!cpMatch) return null

    const kg = cpMatch[1]
    const gnr = cpMatch[2].replace(/^0+/, '') || '0'

    // 3. BEV gst API — exakte Parzellengeometrie + Fläche
    const gstUrl = `https://kataster.bev.gv.at/at.gv.bev.kataster/api/gst/${kg}/${gnr}/`
    const gstRes = await fetch(gstUrl, {
      headers: { 'User-Agent': 'bureau-gala-planung-tool/1.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (!gstRes.ok) return null
    const gst = await gstRes.json()

    const props = gst.properties ?? {}
    const geom = gst.geometry ?? {}

    // Fläche aus Nutzungen summieren
    const nutzungen: Array<{ fl: number }> = props.nutzungen ?? []
    const grundstueck_m2 = nutzungen.reduce((s, n) => s + (n.fl ?? 0), 0)

    // Polygon-Koordinaten (GeoJSON: [lng, lat])
    let coords: [number, number][] = []
    if (geom.type === 'Polygon') {
      coords = geom.coordinates?.[0] ?? []
    } else if (geom.type === 'MultiPolygon') {
      coords = geom.coordinates?.[0]?.[0] ?? []
    }

    if (coords.length === 0) return null

    // Bounding Box → physikalische Maße
    const lngs = coords.map((c: [number, number]) => c[0])
    const lats = coords.map((c: [number, number]) => c[1])
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)
    const breite_m = Math.round((maxLng - minLng) * 111320 * cosLat * 10) / 10
    const tiefe_m = Math.round((maxLat - minLat) * 111320 * 10) / 10

    return {
      kg,
      gnr,
      ez: props.ez ? String(props.ez) : undefined,
      grundstueck_m2: grundstueck_m2 || Math.round(breite_m * tiefe_m),
      breite_m: breite_m || 20,
      tiefe_m: tiefe_m || 20,
      parcel_polygon: coords,
    }
  } catch (e) {
    console.error('[visualisierung/kataster]', e)
    return null
  }
}

// ─── Plandokument-DB (pe-tool petool DB) ─────────────────────────────────────
// Tabellen: plandok_areas (bbox), plandok_regeln (bauweise, bauklasse, …)
// PLANDOK_DB_URL = postgresql://peuser:pw@pe-postgres:5432/petool

let _plandokPool: Pool | null = null
function getPlandokPool(): Pool | null {
  const url = process.env.PLANDOK_DB_URL
  if (!url) return null
  if (!_plandokPool) {
    _plandokPool = new Pool({
      connectionString: url,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    })
  }
  return _plandokPool
}

interface PlandokResult {
  bezug: string
  bauweise: string | null
  bauklasse: string | null
  widmung: string | null
  maxHoeheM: number | null
  setbackFrontM: number | null
  setbackSideM: number | null
  setbackRearM: number | null
  pdfUrl: string | null
  anmerkung: string | null
}

async function queryPlandokument(lat: number, lng: number): Promise<PlandokResult | null> {
  const pool = getPlandokPool()
  if (!pool) return null

  try {
    const rows = await pool.query<PlandokResult>(`
      SELECT
        a.bezug,
        r.bauweise,
        r.bauklasse,
        r.widmung,
        r."maxHoeheM",
        r."setbackFrontM",
        r."setbackSideM",
        r."setbackRearM",
        r."pdfUrl",
        r.anmerkung
      FROM plandok_areas a
      JOIN plandok_regeln r ON r.bezug = a.bezug
      WHERE $1::numeric BETWEEN a."bboxMinLng" AND a."bboxMaxLng"
        AND $2::numeric BETWEEN a."bboxMinLat" AND a."bboxMaxLat"
      ORDER BY (a."bboxMaxLng" - a."bboxMinLng") * (a."bboxMaxLat" - a."bboxMinLat") ASC
      LIMIT 1
    `, [lng, lat])

    return rows.rows[0] ?? null
  } catch (e) {
    console.error('[visualisierung/plandok]', e)
    return null
  }
}

// ─── BO Wien Berechnung ───────────────────────────────────────────────────────

interface BauParams {
  // Grundstück
  grundstueck_m2: number
  breite_m?: number
  tiefe_m?: number
  // Widmung
  bauklasse: string
  bebauungsweise: string
  // Optionale Overrides
  gebaeudehoehe_override?: number
  bebauungsgrad_override?: number
  bauwich_vorne_override?: number
  bauwich_seitlich_override?: number
  bauwich_hinten_override?: number
  // Anzeige
  adresse?: string
  bezirk?: number
  widmung?: string
  widmung_text?: string
  plandokument_nr?: string
  plandokument_url?: string
  schutzzone?: boolean
  bebauungsweise_text?: string
  bebauungsweise_quelle?: string
}

function berechneBoWien(p: BauParams): BauParam & { bebauungsweise_quelle: string; kg?: string; gnr?: string; ez?: string; parcel_polygon?: [number, number][] } {
  const {
    bauklasse, bebauungsweise,
    gebaeudehoehe_override, bebauungsgrad_override,
    bauwich_vorne_override, bauwich_seitlich_override, bauwich_hinten_override,
  } = p

  // Gebäudehöhe §75/76 BO Wien
  const gebaeudehoehe = gebaeudehoehe_override ?? BAUKLASSE_GEBAEUDEHOEHE[bauklasse] ?? 7.5
  const maxGeschosse = BAUKLASSE_GESCHOSSE[bauklasse] ?? 2
  const dachform: 'sattel' | 'flach' = (bauklasse === 'I' || bauklasse === 'II') ? 'sattel' : 'flach'

  // Bebauungsweise normalisieren
  const bwNorm = bebauungsweise.toLowerCase()
  const isGeschlossen = bwNorm === 'g' || bwNorm.startsWith('geschlossen')
    || bwNorm === 'gr' || bwNorm.startsWith('gemischt')
  const isGekuppelt = bwNorm === 'gk' || bwNorm.startsWith('gekuppelt')

  // Bauwich §78 BO Wien
  let bauwich_s: number
  let bauwich_v: number
  let bauwich_h: number

  if (bauwich_seitlich_override !== undefined || bauwich_vorne_override !== undefined || bauwich_hinten_override !== undefined) {
    // Vollständiger Plandokument-Override
    bauwich_s = bauwich_seitlich_override ?? 0
    bauwich_v = bauwich_vorne_override ?? 0
    bauwich_h = bauwich_hinten_override ?? 0
  } else if (isGeschlossen) {
    // §78 Abs. 1: Kein Bauwich bei geschlossener Bebauungsweise
    bauwich_s = 0; bauwich_v = 0; bauwich_h = 0
  } else if (isGekuppelt) {
    // Gekuppelt: einseitig an Grundgrenze, andere Seite wie offen
    const bs = minSeitlicherBauwich(bauklasse, gebaeudehoehe, 'o')
    bauwich_s = Math.round(bs / 2 * 10) / 10
    bauwich_v = bauwich_vorne_override ?? 3.0
    bauwich_h = bauwich_hinten_override ?? 3.0
  } else {
    // Offen §78 Abs. 2: seitlicher Bauwich = max(h/2, Mindestbauwich)
    bauwich_s = Math.round(minSeitlicherBauwich(bauklasse, gebaeudehoehe, 'o') * 10) / 10
    bauwich_v = bauwich_vorne_override ?? 3.0
    bauwich_h = bauwich_hinten_override ?? 3.0
  }

  // Grundstücksmaße
  const flaeche = p.grundstueck_m2
  let breite = p.breite_m ?? 0
  let tiefe = p.tiefe_m ?? 0

  if (breite > 0 && tiefe === 0) tiefe = flaeche / breite
  else if (tiefe > 0 && breite === 0) breite = flaeche / tiefe
  else if (breite === 0 && tiefe === 0) {
    breite = Math.sqrt(flaeche / 1.6) // Wiener Straßenparzellen-Verhältnis 1:1.6
    tiefe = flaeche / breite
  }
  breite = Math.round(breite * 10) / 10
  tiefe = Math.round(tiefe * 10) / 10

  // Baukörper
  const bk_breite = Math.max(0, Math.round((breite - 2 * bauwich_s) * 10) / 10)
  const bk_tiefe = Math.max(0, Math.round((tiefe - bauwich_v - bauwich_h) * 10) / 10)

  // Bebauungsdichte §79 BO Wien
  const bebauungsgrad = bebauungsgrad_override ?? maxBebauungsgrad(bauklasse, bebauungsweise)
  const bebaute_flaeche = Math.round(Math.min(bk_breite * bk_tiefe, flaeche * bebauungsgrad))
  const bgf = Math.round(bebaute_flaeche * maxGeschosse * 0.95)   // 5% Konstruktion
  const ngf = Math.round(bgf * 0.78)                               // NGF ~78% von BGF (Wohnen)
  const stellplaetze = Math.ceil(ngf / 100)                        // §50 BO Wien

  const bebauungsweise_text = p.bebauungsweise_text
    ?? BEBAUUNGSWEISE_TEXT[bebauungsweise]
    ?? bebauungsweise

  // Hinweise
  const hinweise: string[] = []

  if (p.bebauungsweise_quelle?.startsWith('Bezirk-Richtwert')) {
    hinweise.push(`Bebauungsweise: ${bebauungsweise_text} — Schätzwert (${p.bebauungsweise_quelle}). Wien OGD enthält kein Bebauungsweise-Feld. Für Genehmigungsplanung Plandokument MA 21 prüfen (www.wien.gv.at/bebauungsplaene).`)
  } else if (p.bebauungsweise_quelle && p.bebauungsweise_quelle !== 'manuell') {
    hinweise.push(`Bebauungsweise: ${bebauungsweise_text} — Quelle: ${p.bebauungsweise_quelle}.`)
  }

  if (p.schutzzone) hinweise.push('SCHUTZZONE §2 Z 52 BO Wien: Erhaltung der Struktur und des äußeren Erscheinungsbildes gesetzlich vorgeschrieben. Sanierung statt Abriss.')
  if (gebaeudehoehe_override) hinweise.push(`Gebäudehöhe ${gebaeudehoehe_override} m aus Bebauungsplan — abweichend vom BO Wien-Standardwert für BKl. ${bauklasse} (${BAUKLASSE_GEBAEUDEHOEHE[bauklasse]} m).`)
  if (bebauungsgrad_override) hinweise.push(`Bebauungsgrad ${Math.round(bebauungsgrad_override * 100)} % aus Bebauungsplan — abweichend vom §79-Standardwert.`)
  if (bauwich_vorne_override || bauwich_seitlich_override || bauwich_hinten_override) {
    hinweise.push('Bauwich-Werte aus Plandokument übernommen — Baufluchtlinien wurden berücksichtigt.')
  }
  if (!p.widmung || p.widmung === '—') {
    hinweise.push('Keine Widmungsabfrage — Werte basieren ausschließlich auf manuellen Eingaben. Flächenwidmungsplan unter www.wien.gv.at/flaechenwidmung prüfen.')
  }

  const optimierungstipps: string[] = [
    ...(maxGeschosse >= 2 ? ['Dachgeschossausbau §81 BO Wien: erhöht NGF um ca. 25–40 % ohne Anrechnung auf Bebauungsgrad (kein Bauland-Mehrbedarf).'] : []),
    'Technische Aufbauten (Lift, Lüftung) bis max. 3,0 m über Gebäudeabschluss zulässig (§81 Abs. 6).',
    ...(!isGeschlossen ? ['§69 BO Wien: Abweichung vom Bebauungsplan auf Antrag möglich, wenn kein öffentliches Interesse entgegensteht und das Ortsbild nicht beeinträchtigt wird.'] : []),
    ...(bauklasse === 'I' || bauklasse === 'II' ? ['Keller §63: Bei Hanglage als Vollgeschoss möglich — erhöht Nutzfläche ohne Anrechnung auf Gebäudehöhe.'] : []),
  ]

  return {
    adresse: p.adresse ?? 'Manuelle Eingabe',
    lat: 0, lng: 0,
    grundstueck_m2: flaeche,
    breite_m: breite,
    tiefe_m: tiefe,
    bezirk: p.bezirk,
    widmung: p.widmung ?? '—',
    widmung_text: p.widmung_text ?? '—',
    bebaubar: true,
    bauklasse,
    bebauungsweise,
    bebauungsweise_text,
    bebauungsweise_quelle: p.bebauungsweise_quelle ?? 'manuell',
    plandokument_nr: p.plandokument_nr,
    plandokument_url: p.plandokument_url,
    schutzzone: p.schutzzone ?? false,
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
    // Kataster-Felder (werden ggf. vom Aufrufer überschrieben)
    kg: undefined,
    gnr: undefined,
    ez: undefined,
    parcel_polygon: undefined,
  }
}

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json()
  const { modus } = body

  // ══════════════════════════════════════════════════════════════════════════
  // WEG 1: MANUELLE EINGABE — alle Parameter bekannt, keine externen Abfragen
  // ══════════════════════════════════════════════════════════════════════════
  if (modus === 'manuell') {
    const {
      grundstueck_m2, breite_m, tiefe_m,
      bauklasse, bebauungsweise,
      gebaeudehoehe_override, bebauungsgrad_override,
      bauwich_vorne_override, bauwich_seitlich_override, bauwich_hinten_override,
      bezeichnung, plandokument_nr, schutzzone,
    } = body

    if (!grundstueck_m2 || !bauklasse || !bebauungsweise) {
      return Response.json({
        error: 'Pflichtfelder: Grundstücksfläche, Bauklasse und Bebauungsweise sind erforderlich.',
      }, { status: 400 })
    }

    const result = berechneBoWien({
      grundstueck_m2: parseFloat(grundstueck_m2),
      breite_m: breite_m ? parseFloat(breite_m) : undefined,
      tiefe_m: tiefe_m ? parseFloat(tiefe_m) : undefined,
      bauklasse,
      bebauungsweise,
      gebaeudehoehe_override: gebaeudehoehe_override ?? undefined,
      bebauungsgrad_override: bebauungsgrad_override ?? undefined,
      bauwich_vorne_override: bauwich_vorne_override ?? undefined,
      bauwich_seitlich_override: bauwich_seitlich_override ?? undefined,
      bauwich_hinten_override: bauwich_hinten_override ?? undefined,
      adresse: bezeichnung || undefined,
      plandokument_nr: plandokument_nr || undefined,
      schutzzone: schutzzone ?? false,
      bebauungsweise_quelle: 'manuell',
    })

    return Response.json(result)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WEG 2: ADRESSABFRAGE — Geocoding + WFS + Plandokument-DB
  // ══════════════════════════════════════════════════════════════════════════

  const {
    adresse,
    grundstueck_m2: flaeche_input,
    breite_m: breite_input,
    tiefe_m: tiefe_input,
    bebauungsweise_override,
  } = body

  if (!adresse?.trim()) {
    return Response.json({ error: 'Adresse ist erforderlich.' }, { status: 400 })
  }

  // 1. Geocoding + BEV Kataster (parallel)
  const [coords, kataster] = await Promise.all([
    geocodeAdresse(adresse),
    null as null,  // Platzhalter, Kataster nach Geocoding
  ])

  if (!coords) {
    return Response.json({
      error: 'Adresse konnte nicht aufgelöst werden. Bitte eine Wiener Adresse mit Hausnummer und Bezirk eingeben (z. B. „Mariahilfer Straße 100, 1060 Wien").',
    }, { status: 404 })
  }

  // 2. BEV Kataster + Wien WFS + Plandokument-DB (parallel)
  const [katasterResult, widmungData, plandok] = await Promise.all([
    getKatasterParcel(coords.lat, coords.lng),
    getWidmungAmPunkt(coords.lat, coords.lng).catch(() => null),
    queryPlandokument(coords.lat, coords.lng).catch(() => null),
  ])

  // ─── Grundstücksmaße: Kataster hat Vorrang vor Formular-Input ───────────────

  // Kataster liefert exakte Fläche + Geometrie → Vorrang vor manueller Eingabe
  const grundstueck_m2 = katasterResult?.grundstueck_m2
    || parseFloat(String(flaeche_input)) || 800
  const breite_m_final = katasterResult?.breite_m
    || parseFloat(String(breite_input)) || undefined
  const tiefe_m_final = katasterResult?.tiefe_m
    || parseFloat(String(tiefe_input)) || undefined

  // ─── Widmungsparameter auflösen ──────────────────────────────────────────

  const widmungCode = widmungData?.widmung ?? ''
  const widmungText = WIDMUNG_TEXT[widmungCode] ?? widmungData?.widmung_txt ?? (widmungCode || 'Unbekannt')

  if (widmungCode && !isBauland(widmungCode)) {
    return Response.json({
      error: `Das Grundstück ist NICHT bebaubar — Widmung: ${widmungText} (${widmungCode}). Bitte eine bebaubare Fläche (Wohngebiet, Gemischtes Baugebiet …) wählen.`,
    }, { status: 422 })
  }

  // Bauklasse: Plandokument → WFS-Code → Fallback
  const bauklasse = (
    plandok?.bauklasse?.trim().toUpperCase() ||
    bauklasseAusWidmung(widmungCode) ||
    'II'
  )

  // Bebauungsweise: Formular-Override → Plandokument-DB → Bezirk-Heuristik
  const bezirk = widmungData?.bezirk
  const bwFromPlandok = parseBebauungsweise(plandok?.bauweise ?? null)
  const bwBezirkDefault: string | null = bezirk != null ? (bezirk <= 9 ? 'g' : 'o') : null

  const bebauungsweise = (bebauungsweise_override?.trim() || null)
    || bwFromPlandok || bwBezirkDefault || ''

  const bwQuelle = bebauungsweise_override ? 'manuell'
    : bwFromPlandok ? `Plandokument ${plandok?.bezug ?? ''}`
    : bwBezirkDefault ? `Bezirk-Richtwert (${bezirk}. Bezirk)`
    : 'unbekannt'

  const bebauungsweise_text = BEBAUUNGSWEISE_TEXT[bebauungsweise]
    ?? (bebauungsweise.toLowerCase().includes('geschlossen') ? 'geschlossene Bebauungsweise'
      : bebauungsweise.toLowerCase().includes('offen') ? 'offene Bebauungsweise'
      : bebauungsweise || 'nicht bestimmt')

  const result = berechneBoWien({
    grundstueck_m2,
    breite_m: breite_m_final,
    tiefe_m: tiefe_m_final,
    bauklasse,
    bebauungsweise,
    gebaeudehoehe_override: plandok?.maxHoeheM ?? undefined,
    bauwich_vorne_override: plandok?.setbackFrontM ?? undefined,
    bauwich_seitlich_override: plandok?.setbackSideM ?? undefined,
    bauwich_hinten_override: plandok?.setbackRearM ?? undefined,
    adresse: coords.adresse_aufgeloest,
    bezirk,
    widmung: widmungCode || '—',
    widmung_text: widmungText,
    plandokument_nr: plandok?.bezug,
    plandokument_url: plandok?.pdfUrl ?? undefined,
    schutzzone: false,
    bebauungsweise_text,
    bebauungsweise_quelle: bwQuelle,
  })

  // Kataster-Felder anhängen
  if (katasterResult) {
    result.kg = katasterResult.kg
    result.gnr = katasterResult.gnr
    result.ez = katasterResult.ez
    result.parcel_polygon = katasterResult.parcel_polygon
  }

  return Response.json(result)
}
