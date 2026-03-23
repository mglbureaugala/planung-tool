import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Du bist ein erfahrener Architekt und Planungsexperte mit tiefem Wissen aus der Bauentwurfslehre (Neufert) und österreichischen Normen.

Deine Aufgabe: Erstelle strukturierte Raumprogramme für Architekturprojekte.

Bei jedem Raumprogramm:
- Orientiere dich an Neufert-Richtwerten für Flächen und Proportionen
- Berücksichtige österreichische Normen (OIB, ÖNORM)
- Unterscheide Hauptnutzfläche (HNF), Nebennutzfläche (NNF), Verkehrsfläche (VF), Technikfläche (TF)
- Gib realistische BGF-Faktoren an (typisch: BGF = HNF × 1.35–1.5)
- Denke an Erschließung, Barrierefreiheit, Fluchtwege

Antworte IMMER als valides JSON mit dieser Struktur:
{
  "zusammenfassung": "...",
  "raeume": [
    {
      "bezeichnung": "...",
      "anzahl": 1,
      "flaeche_je": 25.0,
      "flaeche_gesamt": 25.0,
      "kategorie": "HNF|NNF|VF|TF",
      "neufert_referenz": "...",
      "anmerkung": "..."
    }
  ],
  "flaechenbilanz": {
    "hnf": 0,
    "nnf": 0,
    "vf": 0,
    "tf": 0,
    "ngf": 0,
    "bgf_faktor": 1.4,
    "bgf_gesamt": 0
  },
  "empfehlungen": ["..."],
  "neufert_hinweise": ["..."]
}`

export async function POST(req: Request) {
  const { gebaeudetyp, parameter, name, save } = await req.json()

  const prompt = `Erstelle ein detailliertes Raumprogramm für:

Gebäudetyp: ${gebaeudetyp}
${parameter ? `Parameter: ${JSON.stringify(parameter, null, 2)}` : ''}

Sei spezifisch mit Neufert-Richtwerten. Alle Flächen in m².`

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return Response.json({ error: 'Parse error' }, { status: 500 })

  const ergebnis = JSON.parse(jsonMatch[0])

  if (save && name) {
    const saved = await db.raumprogramm.create({
      data: { name, gebaeudetyp, parameter: parameter ?? {}, ergebnis },
    })
    return Response.json({ ergebnis, id: saved.id })
  }

  return Response.json({ ergebnis })
}

export async function GET() {
  const list = await db.raumprogramm.findMany({
    orderBy: { erstelltAm: 'desc' },
    select: { id: true, name: true, gebaeudetyp: true, erstelltAm: true },
  })
  return Response.json(list)
}
