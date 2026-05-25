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

  // Sort: priced cards (cheapest USD first), then foil-only, then no price
  const sorted = [...cards].sort((a, b) => {
    const aUsd = a.prices?.usd ? parseFloat(a.prices.usd) : null
    const bUsd = b.prices?.usd ? parseFloat(b.prices.usd) : null
    const aFoil = a.prices?.usd_foil ? parseFloat(a.prices.usd_foil) : null
    const bFoil = b.prices?.usd_foil ? parseFloat(b.prices.usd_foil) : null

    const aPrice = aUsd ?? aFoil
    const bPrice = bUsd ?? bFoil

    if (aPrice !== null && bPrice !== null) return aPrice - bPrice
    if (aPrice !== null) return -1
    if (bPrice !== null) return 1
    return 0
  })

  return NextResponse.json({ printings: sorted })
}
