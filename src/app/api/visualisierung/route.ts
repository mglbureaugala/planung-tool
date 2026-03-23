import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Du bist ein Experte für Wiener Baurecht und Bebauungsplanung.

Berechne die exakten Planungsparameter für das angegebene Grundstück nach Wiener Bauordnung.

Wichtige Wiener Bauordnungs-Referenzwerte:
- Bauklasse I: max 2 Vollgeschosse, Traufe max 7.5m, GRZ typ. 0.35–0.40, GFZ typ. 0.60–0.80, Dachform: Satteldach bevorzugt
- Bauklasse II: max 3–4 Vollgeschosse, Traufe max 12–14m, GRZ typ. 0.40–0.50, GFZ typ. 1.20–1.60
- Bauklasse III: max 4–6 Vollgeschosse, Traufe max 16–20m, GRZ typ. 0.50–0.60, GFZ typ. 2.00–3.00
- Bauklasse IV: max 6–9 Vollgeschosse, Traufe max 20–26m, GRZ bis 0.65, GFZ bis 4.50
- Bauklasse V: keine Höhenbeschränkung, Hochhausprüfung erforderlich

Offene Bauweise: Bauwich seitlich = h/2, mind. 3m (BK I), mind. 6m (BK II+)
Geschlossene Bauweise: kein seitlicher Bauwich
Vorderer Bauwich: per Bebauungsplan, typ. 5m Wohngebiet, 0m geschlossene Bauweise
Hinterer Bauwich: typ. 3–6m

Berechne den maximalen Baukörper:
- baukörper_breite = plot_breite - 2 × bauwich_seitlich (offen) oder = plot_breite (geschlossen)
- baukörper_tiefe = plot_tiefe - bauwich_vorne - bauwich_hinten
- bebaubare_flaeche = baukörper_breite × baukörper_tiefe (aber max. GRZ × Grundstück)
- bgf_gesamt = bebaubare_flaeche × max_geschosse × 0.95 (leichte Grundrisseffizienz)
- wnf_geschaetzt = bgf_gesamt × 0.68

Antworte NUR mit validem JSON, kein Text davor oder danach:
{
  "bauklasse": "I",
  "widmung": "W2",
  "bauweise": "offen",
  "breite_m": 25.0,
  "tiefe_m": 32.0,
  "grundstueck_m2": 800,
  "grz_max": 0.40,
  "gfz_max": 0.80,
  "max_geschosse": 2,
  "traufenhoehe_m": 7.5,
  "firsthoehe_m": 9.5,
  "dachform": "sattel",
  "geschoss_hoehe_m": 2.8,
  "bauwich_vorne_m": 5.0,
  "bauwich_hinten_m": 3.0,
  "bauwich_seitlich_m": 3.0,
  "baukörper_breite_m": 19.0,
  "baukörper_tiefe_m": 24.0,
  "bebaubare_flaeche_m2": 380,
  "bgf_gesamt_m2": 720,
  "wnf_geschaetzt_m2": 490,
  "stellplaetze_pflicht": 6,
  "hinweise": ["Bauklasse I erfordert offene Bauweise mit mindestens 3m Bauwich."],
  "optimierungstipps": ["Dachgeschossausbau möglich — erhöht Nutzfläche um ca. 30%."]
}`

export async function POST(req: Request) {
  const body = await req.json()
  const { grundstueck_m2, breite_m, tiefe_m, bauklasse, widmung, bauweise, bebauungsplan } = body

  // Tiefe berechnen falls nicht angegeben
  const tiefe = tiefe_m || (breite_m ? grundstueck_m2 / breite_m : Math.sqrt(grundstueck_m2 * 1.3))
  const breite = breite_m || (tiefe_m ? grundstueck_m2 / tiefe_m : Math.sqrt(grundstueck_m2 / 1.3))

  const prompt = `Berechne die Planungsparameter für folgendes Grundstück in Wien:

Grundstücksfläche: ${grundstueck_m2} m²
Breite: ${breite.toFixed(1)} m
Tiefe: ${tiefe.toFixed(1)} m
Bauklasse: ${bauklasse || 'unbekannt – schätze aus Widmung'}
Widmung: ${widmung || 'W2 – Wohngebiet'}
Bauweise: ${bauweise || 'offen'}
${bebauungsplan ? `Bebauungsplan-Hinweise: ${bebauungsplan}` : ''}

Berechne den maximalen Baukörper und alle Planungsparameter exakt.`

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return Response.json({ error: 'Parse error', raw }, { status: 500 })

  return Response.json(JSON.parse(jsonMatch[0]))
}
