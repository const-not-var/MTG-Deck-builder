import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get("name")
  if (!name) return NextResponse.json({ printings: [] })

  const res = await fetch(
    `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"+game:paper&unique=prints&order=usd&dir=asc`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return NextResponse.json({ printings: [] })

  const data = await res.json()
  return NextResponse.json({ printings: data.data ?? [] })
}
