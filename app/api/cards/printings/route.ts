import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get("name")
  if (!name) return NextResponse.json({ printings: [] })

  const res = await fetch(
    `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"+game:paper&unique=prints&order=released&dir=desc`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return NextResponse.json({ printings: [] })

  const data = await res.json()
  const cards = data.data ?? []

  // Sort: USD priced first (cheapest), then EUR-only, then no price at all
  const getPrice = (c: { prices?: { usd?: string | null; usd_foil?: string | null; eur?: string | null; eur_foil?: string | null } }) => {
    const usd = c.prices?.usd ? parseFloat(c.prices.usd) : null
    const usdFoil = c.prices?.usd_foil ? parseFloat(c.prices.usd_foil) : null
    return usd ?? usdFoil ?? null
  }
  const hasUsd = (c: typeof cards[0]) => !!(c.prices?.usd || c.prices?.usd_foil)
  const hasAnyPrice = (c: typeof cards[0]) => !!(c.prices?.usd || c.prices?.usd_foil || c.prices?.eur || c.prices?.eur_foil)

  const sorted = [...cards].sort((a, b) => {
    const aHasUsd = hasUsd(a)
    const bHasUsd = hasUsd(b)
    const aHasAny = hasAnyPrice(a)
    const bHasAny = hasAnyPrice(b)

    // USD priced before EUR-only before no price
    if (aHasUsd && !bHasUsd) return -1
    if (!aHasUsd && bHasUsd) return 1
    if (aHasAny && !bHasAny) return -1
    if (!aHasAny && bHasAny) return 1

    // Within USD-priced group, sort cheapest first
    const aP = getPrice(a)
    const bP = getPrice(b)
    if (aP !== null && bP !== null) return aP - bP
    return 0
  })

  return NextResponse.json({ printings: sorted })
}
