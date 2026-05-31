import { NextResponse } from "next/server"
import { auth } from "@/auth"

export interface EnrichedCard {
  oracleText: string
  typeLine: string
  colorIdentity: string[]
  tcgplayerUrl?: string
  cardKingdomUrl?: string
  imageUriBack?: string
  loyalty?: string
}

/**
 * POST /api/cards/enrich
 *
 * Accepts a list of Scryfall IDs and returns the latest oracle text, type line,
 * and color identity for each card directly from Scryfall.
 *
 * Used to:
 *  - Backfill oracleText on decks saved before that field was added
 *  - Pick up rules errata on any card (WotC sometimes revises oracle text)
 *
 * Scryfall's /cards/collection endpoint accepts up to 75 IDs per request.
 * This route automatically batches larger lists.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []
  if (ids.length === 0) return NextResponse.json({ cards: {} })

  const result: Record<string, EnrichedCard> = {}

  for (let i = 0; i < ids.length; i += 75) {
    const batch = ids.slice(i, i + 75)
    try {
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
      })
      if (!res.ok) continue

      const data = await res.json()
      for (const card of data.data ?? []) {
        // DFC cards store oracle text per-face rather than on the root object
        const oracleText: string =
          card.oracle_text ??
          (card.card_faces ?? [])
            .map((f: { oracle_text?: string }) => f.oracle_text ?? "")
            .join("\n")

        result[card.id] = {
          oracleText,
          typeLine: card.type_line ?? "",
          colorIdentity: card.color_identity ?? [],
          tcgplayerUrl: card.purchase_uris?.tcgplayer,
          cardKingdomUrl: card.purchase_uris?.cardkingdom,
          imageUriBack: card.card_faces?.[1]?.image_uris?.normal,
          loyalty: card.loyalty,
        }
      }
    } catch {
      // Best-effort — if a batch fails, continue with the rest
    }
  }

  return NextResponse.json({ cards: result })
}
