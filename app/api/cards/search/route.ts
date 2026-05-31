import { NextResponse } from "next/server"
import { autocompleteCards, getCardByName } from "@/lib/scryfall"

// Splits a raw query into name / setCode / collectorNum components.
// Set code is only extracted when a collector number is also present,
// and must be ≤3 chars so short name words (e.g. "Ring") aren't mistaken for it.
function parseQuery(raw: string) {
  const tokens = raw.trim().split(/\s+/)

  let collectorNum: string | null = null
  const withoutNum = tokens.filter((t) => {
    if (/^\d+$/.test(t) && collectorNum === null) { collectorNum = t; return false }
    return true
  })

  let setCode: string | null = null
  let nameTokens = withoutNum
  if (collectorNum !== null) {
    // Only the last token, and only if it's 2–4 letters (typical set code length)
    const last = withoutNum[withoutNum.length - 1]
    if (last && /^[a-zA-Z]{2,4}$/.test(last)) {
      setCode = last.toLowerCase()
      nameTokens = withoutNum.slice(0, -1)
    }
  }

  return { name: nameTokens.join(" ").trim(), setCode, collectorNum }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const fetchFull = searchParams.get("full") === "1"

  if (q.length < 2) return NextResponse.json({ names: [] })

  if (fetchFull) {
    const card = await getCardByName(q)
    return NextResponse.json({ card })
  }

  const { name, setCode, collectorNum } = parseQuery(q)

  // ── Collector / set lookup paths ──────────────────────────────────────────

  // Exact set + number with no name → fetch the single card directly
  if (!name && setCode && collectorNum) {
    const res = await fetch(`https://api.scryfall.com/cards/${setCode}/${collectorNum}`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const card = await res.json()
      return NextResponse.json({ type: "collector", cards: [card] })
    }
    return NextResponse.json({ type: "collector", cards: [] })
  }

  // Number only (no name, no set) → search all printings with that collector number
  if (!name && !setCode && collectorNum) {
    const res = await fetch(
      `https://api.scryfall.com/cards/search?q=cn:${collectorNum}+game:paper&unique=prints&order=released&dir=desc`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return NextResponse.json({ type: "collector", cards: [] })
    const data = await res.json()
    return NextResponse.json({ type: "collector", cards: data.data ?? [] })
  }

  // Name + collector number (± set code) → search printings matching all criteria
  if (name && collectorNum) {
    const parts = [`!"${name}"`, `cn:${collectorNum}`, "game:paper"]
    if (setCode) parts.push(`s:${setCode}`)
    const res = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(parts.join(" "))}&unique=prints&order=released&dir=desc`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return NextResponse.json({ type: "collector", cards: [] })
    const data = await res.json()
    return NextResponse.json({ type: "collector", cards: data.data ?? [] })
  }

  // ── Name autocomplete (default path) ─────────────────────────────────────
  const names = await autocompleteCards(q)
  return NextResponse.json({ type: "names", names: names.slice(0, 10) })
}
