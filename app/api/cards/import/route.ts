import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { readJson, cardNamesSchema } from "@/lib/api"

const BATCH_SIZE = 75

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = cardNamesSchema.safeParse(await readJson(req))
  if (!parsed.success || parsed.data.names.length === 0) {
    return NextResponse.json({ cards: [], notFound: [] })
  }

  const UA = "CommanderVault/1.0 (commandervault.net)"
  const uniqueNames: string[] = [...new Set<string>(parsed.data.names.filter(Boolean))]
  const allCards: { name: string }[] = []
  const exactMisses: string[] = []
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // Pass 1 — exact (case-insensitive) match via the collection endpoint.
  for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + BATCH_SIZE)
    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    })
    if (!res.ok) continue
    const data = await res.json()
    allCards.push(...(data.data ?? []))
    exactMisses.push(...(data.not_found ?? []).map((nf: { name?: string }) => nf.name ?? "").filter(Boolean))
    if (i + BATCH_SIZE < uniqueNames.length) await sleep(80)
  }

  // Pass 2 — fuzzy fallback for names that didn't match exactly (accents, DFC
  // names, minor typos). `aliases` maps the requested name → the resolved card
  // name so the client can still apply the right quantity.
  const aliases: Record<string, string> = {}
  const notFound: string[] = []
  for (const name of exactMisses) {
    try {
      const r = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`, {
        headers: { "User-Agent": UA },
      })
      if (r.ok) {
        const card = await r.json()
        allCards.push(card)
        aliases[name.toLowerCase()] = card.name
      } else {
        notFound.push(name)
      }
    } catch {
      notFound.push(name)
    }
    await sleep(80)
  }

  return NextResponse.json({ cards: allCards, notFound, aliases })
}
