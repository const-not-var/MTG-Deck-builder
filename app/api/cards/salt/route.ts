import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { readJson, cardNamesSchema } from "@/lib/api"

/**
 * Converts a card name to the slug EDHREC uses in its URL paths.
 * e.g. "Teferi's Protection" → "teferis-protection"
 *      "Jace, the Mind Sculptor" → "jace-the-mind-sculptor"
 */
function toEdhrecSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip diacritics
    .replace(/æ/gi, "ae")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")       // remove punctuation
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

/**
 * POST /api/cards/salt
 *
 * Accepts { names: string[] } and returns salt scores from EDHREC.
 * Salt is a float on ~0–4 scale reflecting how "unfun" players find a card.
 * Requests are batched to avoid rate-limiting EDHREC.
 * Next.js caches each individual EDHREC fetch for 24 h at the edge.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = cardNamesSchema.safeParse(await readJson(req))
  if (!parsed.success || parsed.data.names.length === 0) return NextResponse.json({ salt: {} })
  const names = parsed.data.names

  const result: Record<string, number> = {}

  // Batch into groups of 10 to avoid hammering EDHREC
  const BATCH = 10
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (name) => {
        try {
          // DFCs have names like "Front // Back" — EDHREC only knows the front face
          const frontName = name.includes(" // ") ? name.split(" // ")[0].trim() : name
          const slug = toEdhrecSlug(frontName)
          const res = await fetch(
            `https://json.edhrec.com/pages/cards/${slug}.json`,
            {
              headers: { "User-Agent": "Commander Vault/1.0" },
              next: { revalidate: 86400 },
            }
          )
          if (!res.ok) return
          const data = await res.json()
          const salt = data?.container?.json_dict?.card?.salt
          if (typeof salt === "number") result[name] = salt
        } catch {
          // Best-effort — if a card fails, skip it
        }
      })
    )
    // Small pause between batches
    if (i + BATCH < names.length) {
      await new Promise((r) => setTimeout(r, 80))
    }
  }

  return NextResponse.json({ salt: result })
}
