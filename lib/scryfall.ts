import type { ScryfallCard } from "@/types"

const BASE = "https://api.scryfall.com"

export function getCardImageUri(card: ScryfallCard): string {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return ""
}

export function getCardImageUriBack(card: ScryfallCard): string | undefined {
  if (card.card_faces?.[1]?.image_uris?.normal) return card.card_faces[1].image_uris.normal
  return undefined
}

export function getCardSmallImageUri(card: ScryfallCard): string {
  if (card.image_uris?.small) return card.image_uris.small
  if (card.card_faces?.[0]?.image_uris?.small) return card.card_faces[0].image_uris.small
  return ""
}

export async function autocompleteCards(query: string): Promise<string[]> {
  if (query.length < 2) return []
  const res = await fetch(`${BASE}/cards/autocomplete?q=${encodeURIComponent(query)}`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data as string[]
}

export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const res = await fetch(`${BASE}/cards/named?exact=${encodeURIComponent(name)}`, {
    next: { revalidate: 3600 },
  })
  if (res.ok) return res.json()

  const fuzzy = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`, {
    next: { revalidate: 3600 },
  })
  if (fuzzy.ok) return fuzzy.json()
  return null
}

export async function getCardById(id: string): Promise<ScryfallCard | null> {
  const res = await fetch(`${BASE}/cards/${id}`, { next: { revalidate: 3600 } })
  if (!res.ok) return null
  return res.json()
}

export const BASIC_LANDS = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
])

export function isBasicLand(typeLine: string, name: string): boolean {
  return typeLine.includes("Basic Land") || BASIC_LANDS.has(name)
}
