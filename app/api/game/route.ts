import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import Game from "@/models/Game"
import { generateGameCode } from "@/lib/gameInit"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  let code = generateGameCode()
  let attempts = 0
  while (attempts < 5) {
    const exists = await Game.exists({ code })
    if (!exists) break
    code = generateGameCode()
    attempts++
  }

  const game = await Game.create({
    code,
    hostUserId: session.user.id,
    players: [],
    chat: [],
    turn: { currentSeat: 0, phase: "main1", number: 1 },
  })

  return NextResponse.json({ game: { _id: game._id, code: game.code } })
}
