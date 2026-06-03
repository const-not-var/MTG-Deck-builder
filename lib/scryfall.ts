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

/**
 * Re-point a stored Scryfall card-image URL at a different size. Scryfall's
 * image CDN encodes the size as a path segment (…/normal/…/id.jpg, …/png/…/id.png),
 * so we can upgrade a saved `normal` URL to `large`/`png` at render time without
 * re-fetching — existing decks get sharper images with no re-import.
 * `png` is the highest-resolution face (745×1040) and the only one served as .png.
 * Non-Scryfall URLs (or already-correct ones) are returned untouched.
 */
export function scryfallImage(
  uri: string | undefined | null,
  size: "small" | "normal" | "large" | "png"
): string {
  if (!uri || !uri.includes("cards.scryfall.io")) return uri ?? ""
  let out = uri.replace(/\/(small|normal|large|png|art_crop|border_crop)\//, `/${size}/`)
  out = size === "png"
    ? out.replace(/\.jpg(\?|$)/, ".png$1")
    : out.replace(/\.png(\?|$)/, ".jpg$1")
  return out
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
