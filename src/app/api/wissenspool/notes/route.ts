import { NextRequest, NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'


// GET /api/wissenspool/notes?thema=BERUFSRECHT
export async function GET(req: NextRequest) {
  
  

  const thema = req.nextUrl.searchParams.get('thema')
  const notes = await prisma.ztUserNote.findMany({
    where: thema ? { thema: thema as never } : undefined,
    orderBy: { aktualisiertAm: 'desc' },
  })
  return NextResponse.json({ notes })
}

// POST /api/wissenspool/notes
export async function POST(req: NextRequest) {
  
  

  const { thema, titel, inhalt } = await req.json()
  if (!thema || !inhalt) return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })

  const note = await prisma.ztUserNote.create({ data: { thema, titel, inhalt } })
  return NextResponse.json({ note })
}

// PATCH /api/wissenspool/notes?id=...
export async function PATCH(req: NextRequest) {
  
  

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })

  const { titel, inhalt } = await req.json()
  const note = await prisma.ztUserNote.update({ where: { id }, data: { titel, inhalt } })
  return NextResponse.json({ note })
}

// DELETE /api/wissenspool/notes?id=...
export async function DELETE(req: NextRequest) {
  
  

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })

  await prisma.ztUserNote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
