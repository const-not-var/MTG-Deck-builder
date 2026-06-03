import { NextResponse } from "next/server"
import { isValidObjectId } from "mongoose"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import Game from "@/models/Game"
import Deck from "@/models/Deck"
import { readJson } from "@/lib/api"
import { initPlayerState } from "@/lib/gameInit"
import type { Deck as DeckType } from "@/types"

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = await params
  const body = await readJson(req)
  const deckId: unknown = (body as { deckId?: unknown } | null)?.deckId
  if (typeof deckId !== "string" || !isValidObjectId(deckId)) {
    return NextResponse.json({ error: "Valid deckId required" }, { status: 400 })
  }

  await connectDB()

  const game = await Game.findOne({ code: code.toUpperCase() })
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
  if (game.status !== "lobby") return NextResponse.json({ error: "Game already started" }, { status: 409 })
  if (game.players.length >= game.maxPlayers) return NextResponse.json({ error: "Game is full" }, { status: 409 })

  // Already joined?
  const already = game.players.find((p: { userId: string }) => p.userId === session.user.id)
  if (already) return NextResponse.json({ error: "Already in this game" }, { status: 409 })

  const deck = await Deck.findOne({ _id: deckId, userId: session.user.id }).lean() as DeckType | null
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

  const seatIndex = game.players.length  // next available seat
  const playerState = initPlayerState(
    session.user.id,
    session.user.name ?? "Player",
    seatIndex,
    deck
  )

  game.players.push(playerState)
  await game.save()

  return NextResponse.json({ ok: true })
}
