import { NextResponse } from "next/server"
import { isValidObjectId } from "mongoose"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import DeckModel from "@/models/Deck"
import { readJson, deckUpdateSchema } from "@/lib/api"

async function getDeckOrFail(id: string, userId: string) {
  if (!isValidObjectId(id)) return null   // malformed id → treat as not found (never CastError → 500)
  const deck = await DeckModel.findOne({ _id: id, userId })
  if (!deck) return null
  return deck
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await connectDB()
  const deck = await getDeckOrFail(id, session.user.id)
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

  return NextResponse.json({ deck })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const parsed = deckUpdateSchema.safeParse(await readJson(req))
  if (!parsed.success) return NextResponse.json({ error: "Invalid deck data" }, { status: 400 })
  const body = parsed.data

  await connectDB()
  const deck = await getDeckOrFail(id, session.user.id)
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

  if (body.name !== undefined) deck.name = body.name
  if (body.description !== undefined) deck.description = body.description
  if (body.cards !== undefined) deck.cards = body.cards

  await deck.save()
  return NextResponse.json({ deck })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Deck not found" }, { status: 404 })
  await connectDB()
  const deck = await DeckModel.findOneAndDelete({ _id: id, userId: session.user.id })
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

  return NextResponse.json({ message: "Deck deleted" })
}
