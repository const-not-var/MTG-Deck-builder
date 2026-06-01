import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import DeckModel from "@/models/Deck"

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

  const { name, description, cards } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Deck name is required" }, { status: 400 })

  await connectDB()
  const deck = await DeckModel.create({
    userId: session.user.id,
    name: name.trim(),
    description: description ?? "",
    cards: Array.isArray(cards) ? cards : [],
  })

  return NextResponse.json({ deck }, { status: 201 })
}
