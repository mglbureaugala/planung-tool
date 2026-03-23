import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Du bist ein Architektur-Planungsexperte mit tiefem Wissen aus:
- Bauentwurfslehre Neufert (alle Ausgaben)
- OIB-Richtlinien (RL 1–6)
- Wiener Bauordnung & Bebauungsbestimmungen
- ÖNORM B-Normen
- Barrierefreiheit (ÖNORM B 1600)
- Arbeitsstättenverordnung

Du beantwortest Fragen zu Planungsparametern, Maßen, Normen und Entwurfsregeln.
Benutzer ist DI Matthias Garzon-Lapierre, Architekt und Projektentwickler in Wien, Einzelunternehmer, Fokus auf Planung und Automatisierung von Planungsschritten.

Antworte präzise, nenne konkrete Maße und Normreferenzen. Bei komplexen Fragen strukturiere die Antwort übersichtlich.`

export async function POST(req: Request) {
  const { frage, verlauf } = await req.json()

  const messages = [
    ...(verlauf ?? []).map((m: { rolle: string; text: string }) => ({
      role: m.rolle as 'user' | 'assistant',
      content: m.text,
    })),
    { role: 'user' as const, content: frage },
  ]

  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM,
    messages,
  })

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}
