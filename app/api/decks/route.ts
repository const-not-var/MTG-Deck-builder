import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import DeckModel from "@/models/Deck"
import { readJson, deckCreateSchema } from "@/lib/api"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const decks = await DeckModel.find({ userId: session.user.id })
    .select("_id name description cards createdAt updatedAt")
    .lean()

  return NextResponse.json({ decks })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = deckCreateSchema.safeParse(await readJson(req))
  if (!parsed.success) return NextResponse.json({ error: "Invalid deck data" }, { status: 400 })
  const { name, description, cards } = parsed.data

  await connectDB()
  const deck = await DeckModel.create({
    userId: session.user.id,
    name,
    description: description ?? "",
    cards: cards ?? [],
  })

  return NextResponse.json({ deck }, { status: 201 })
}
