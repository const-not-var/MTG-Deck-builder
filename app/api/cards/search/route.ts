import { NextResponse } from "next/server"
import { autocompleteCards, getCardByName } from "@/lib/scryfall"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")
  const fetchFull = searchParams.get("full") === "1"

  if (!q || q.length < 2) {
    return NextResponse.json({ names: [], card: null })
  }

  if (fetchFull) {
    const card = await getCardByName(q)
    return NextResponse.json({ card })
  }

  const names = await autocompleteCards(q)
  return NextResponse.json({ names: names.slice(0, 10) })
}
