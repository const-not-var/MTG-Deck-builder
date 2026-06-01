import { NextResponse } from "next/server"
import { auth } from "@/auth"

const BATCH_SIZE = 75

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { names } = await req.json()
  if (!Array.isArray(names) || names.length === 0) {
    return NextResponse.json({ cards: [], notFound: [] })
  }

  const uniqueNames: string[] = [...new Set<string>(names.filter(Boolean))]
  const allCards: unknown[] = []
  const notFound: string[] = []

  for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + BATCH_SIZE)
    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CommanderVault/1.0 (commandervault.net)",
      },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    })

    if (!res.ok) continue
    const data = await res.json()
    allCards.push(...(data.data ?? []))
    notFound.push(
      ...(data.not_found ?? []).map(
        (nf: { name?: string }) => nf.name ?? ""
      ).filter(Boolean)
    )

    // Scryfall asks for 50–100ms between requests
    if (i + BATCH_SIZE < uniqueNames.length) {
      await new Promise((r) => setTimeout(r, 80))
    }
  }

  return NextResponse.json({ cards: allCards, notFound })
}
