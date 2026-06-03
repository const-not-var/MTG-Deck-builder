import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import Game from "@/models/Game"
import { applyAction } from "@/lib/applyGameAction"
import { readJson, gameActionSchema } from "@/lib/api"
import type { GameState, GameAction, GameCard } from "@/types/game"

function toPlain(doc: unknown): GameState {
  return JSON.parse(JSON.stringify(doc))
}

// A hidden card keeps only its instance id (so counts/keys stay stable) and
// blanks every identifying field. Used for opponents' hands.
function hiddenCard(c: GameCard): GameCard {
  return {
    instanceId: c.instanceId,
    scryfallId: "", name: "", imageUri: "",
    typeLine: "", manaCost: "", cmc: 0,
    colorIdentity: [], tapped: false, counters: {},
  }
}

// Hide the hidden zones (hand + library contents) of every player except the
// requester. Battlefield / graveyard / exile / command zone are public info and
// stay intact; library size is carried by `libraryCount`, hand size by length.
function redactFor(game: GameState, userId: string): GameState {
  return {
    ...game,
    players: game.players.map(p =>
      p.userId === userId
        ? p
        : { ...p, hand: p.hand.map(hiddenCard), library: [] }),
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = await params
  await connectDB()
  const game = await Game.findOne({ code: code.toUpperCase() }).lean()
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })

  return NextResponse.json({ game: redactFor(toPlain(game), session.user.id) })
}

const MAX_RETRIES = 4

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { code } = await params
  const CODE = code.toUpperCase()

  // Validate the action shape/bounds before it can reach the reducer or the DB.
  const body = await readJson(req)
  const parsed = gameActionSchema.safeParse((body as { action?: unknown } | null)?.action)
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  const action = parsed.data as GameAction

  await connectDB()

  // Optimistic concurrency: read → apply → write only if the version is unchanged.
  // On conflict (another player's write landed first), re-read and re-apply.
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const doc = await Game.findOne({ code: CODE })
    if (!doc) return NextResponse.json({ error: "Game not found" }, { status: 404 })

    const current = toPlain(doc)

    // Only a joined player (or the host) may act on a game.
    const isMember = current.players.some(p => p.userId === userId) || current.hostUserId === userId
    if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const version = (current as { __v?: number }).__v ?? 0
    let next: GameState
    try {
      next = applyAction(current, userId, action)
    } catch {
      // A bad-but-well-typed action (e.g. a zone mismatch) must never 500.
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const res = await Game.replaceOne(
      { code: CODE, __v: version },
      { ...next, _id: doc._id, __v: version + 1, updatedAt: new Date() },
    )

    if (res.matchedCount > 0) {
      return NextResponse.json({ game: redactFor(next, userId) })
    }
    // matchedCount === 0 → version moved under us; loop and retry.
  }

  // Extremely unlikely at this write volume; let the client's next poll reconcile.
  return NextResponse.json({ error: "Conflict, please retry" }, { status: 409 })
}
