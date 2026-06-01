import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import Game from "@/models/Game"
import { applyAction } from "@/lib/applyGameAction"
import type { GameState, GameAction } from "@/types/game"

function toPlain(doc: unknown): GameState {
  return JSON.parse(JSON.stringify(doc))
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = await params
  await connectDB()
  const game = await Game.findOne({ code: code.toUpperCase() }).lean()
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })

  return NextResponse.json({ game: toPlain(game) })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action as GameAction | undefined
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 })

  await connectDB()
  const doc = await Game.findOne({ code: code.toUpperCase() })
  if (!doc) return NextResponse.json({ error: "Game not found" }, { status: 404 })

  const current = toPlain(doc)
  const next = applyAction(current, session.user.id, action)

  // Write updated state back using replaceOne for simplicity
  await Game.replaceOne({ code: code.toUpperCase() }, {
    ...next,
    _id: doc._id,
    updatedAt: new Date(),
  })

  return NextResponse.json({ game: next })
}
