/**
 * Gemeinsame Typen für die Baukörper-Visualisierung
 * Terminologie nach BO Wien (LGBl. Nr. 11/1930 idgF.)
 */

export interface BauParam {
  // Identifikation
  adresse: string
  lat: number
  lng: number
  grundstueck_m2: number
  breite_m: number
  tiefe_m: number
  bezirk?: number

  // Flächenwidmungsplan (§2 WBO Wien, MA 21)
  widmung: string              // Code: W2, GB3, WGV2 …
  widmung_text: string         // Langtext
  bebaubar: boolean

  // Bebauungsplan-Parameter (§§76–79 WBO Wien)
  bauklasse: string            // I, II, III, IV, V
  bebauungsweise: string       // o, g, gk, gr …
  bebauungsweise_text: string  // offene Bebauungsweise …
  plandokument_nr?: string
  plandokument_url?: string
  schutzzone: boolean

  // Gebäudehöhe §75 WBO Wien
  // = Maß vom Fußboden EG bis Oberkante Gebäudeabschluss (Traufenlinie)
  gebaeudehoehe_max_m: number
  max_geschosse: number
  dachform: 'sattel' | 'flach' | 'walm' | 'pult'

  // Bauwich §78 WBO Wien
  bauwich_seitlich_m: number   // seitlicher Bauwich (je Seite)
  bauwich_vorne_m: number      // vorderer Bauwich / Vorgartenzone
  bauwich_hinten_m: number     // hinterer Bauwich

  // Baukörper (Maximalausnützung)
  baukörper_breite_m: number
  baukörper_tiefe_m: number

  // Bebauungsdichte §79 WBO Wien
  bebauungsgrad: number            // zulässiger Bebauungsgrad (0–1)
  bebaute_flaeche_max_m2: number   // max. bebaute Fläche am Boden
  bgf_gesamt_m2: number            // Bruttogeschoßfläche (BGF) gesamt
  ngf_geschaetzt_m2: number        // Nettogeschoßfläche (NGF) geschätzt

  // Sonstiges
  stellplaetze_pflicht: number
  hinweise: string[]
  optimierungstipps: string[]

  // Kataster (BEV DKM, Digitale Katastralmappe — täglich aktualisiert)
  kg?: string                         // Katastralgemeinde-Nr. (5-stellig, z. B. "01010")
  gnr?: string                        // Grundstücksnummer (z. B. "1063")
  ez?: string                         // Einlagezahl (Grundbuch-Bezug)
  parcel_polygon?: [number, number][] // Parzellen-Polygon in WGS84 [lng, lat]
}
