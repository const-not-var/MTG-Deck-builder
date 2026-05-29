import type { CardInDeck } from "@/types"
import { isBasicLand } from "./scryfall"

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

/**
 * How many copies of this card are allowed in a Commander deck.
 * Returns Infinity for basic lands and "A deck can have any number…" cards.
 * Returns a finite number (e.g. 7) for cards like Seven Dwarves or Nazgûl.
 * Returns 1 (singleton) for everything else.
 */
export function getDeckLimit(
  card: Pick<CardInDeck, "name" | "typeLine" | "oracleText">
): number {
  if (isBasicLand(card.typeLine, card.name)) return Infinity

  const o = card.oracleText ?? ""

  // "A deck can have any number of cards named X."
  if (/a deck can have any number of cards named/i.test(o)) return Infinity

  // "A deck can have up to N cards named X." (Seven Dwarves = 7, Nazgûl = 9, …)
  const match = o.match(/a deck can have up to (\w+) cards? named/i)
  if (match) {
    const word = match[1].toLowerCase()
    const num = NUMBER_WORDS[word] ?? parseInt(word, 10)
    return isNaN(num) ? 1 : num
  }

  return 1
}

/** True when a card has no per-copy cap (basic lands + "any number" cards). */
export function isUnlimited(
  card: Pick<CardInDeck, "name" | "typeLine" | "oracleText">
): boolean {
  return getDeckLimit(card) === Infinity
}
