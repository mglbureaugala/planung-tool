import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Du bist ein Experte für Wiener Baurecht und Grundstücksbewertung.

Analysiere Grundstücke nach Wiener Bauordnung und Neufert-Richtwerten.
Benutzer ist DI Matthias Garzon-Lapierre, Architekt und Projektentwickler in Wien.

Antworte IMMER als valides JSON:
{
  "bebaubarkeit": {
    "gfz_max": 2.0,
    "grz_max": 0.4,
    "bgf_max": 0,
    "bebaute_flaeche_max": 0,
    "geschosse_typisch": 4,
    "gebaeudehoeche_max": "..."
  },
  "nutzungsszenarien": [
    {
      "typ": "Wohnbau",
      "bgf": 0,
      "we_anzahl": 0,
      "we_groesse_avg": 80,
      "nebenflaechen": 0,
      "bemerkung": "..."
    }
  ],
  "parkierung": {
    "pflicht_je_we": 1,
    "gesamt_pflicht": 0,
    "stellplaetze_eg": 0,
    "tiefgarage_empfohlen": false,
    "bemerkung": "..."
  },
  "wirtschaftlichkeit": {
    "bri_schaetzung": 0,
    "effizienz_hnf_bgf": "65–70%",
    "empfehlung": "..."
  },
  "risiken": ["..."],
  "naechste_schritte": ["..."]
}`

export async function POST(req: Request) {
  const { grundstueck_m2, widmung, lage, bebauungsplan, projektId } = await req.json()

  const prompt = `Analysiere folgendes Grundstück in Wien:

Grundstücksfläche: ${grundstueck_m2} m²
Widmung: ${widmung || 'unbekannt'}
Lage: ${lage || 'Wien'}
${bebauungsplan ? `Bebauungsplan: ${bebauungsplan}` : ''}

Erstelle eine vollständige Machbarkeitsanalyse mit allen Bebauungsparametern.`

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return Response.json({ error: 'Parse error' }, { status: 500 })

  const ergebnis = JSON.parse(jsonMatch[0])

  const saved = await db.grundstueckCheck.create({
    data: {
      projektId: projektId || null,
      parameter: { grundstueck_m2, widmung, lage, bebauungsplan },
      ergebnis,
    },
  })

  return Response.json({ ergebnis, id: saved.id })
}
