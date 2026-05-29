import type { CardInDeck, DeckValidation } from "@/types"
import { isBasicLand } from "./scryfall"
import { canCoCommand, getCombinedColorIdentity } from "./commander"
import { getDeckLimit } from "./rules"

export function validateDeck(cards: CardInDeck[]): DeckValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const duplicates: string[] = []
  const colorViolations: string[] = []

  const cardCount = cards.reduce((sum, c) => sum + c.quantity, 0)
  const commanders = cards.filter((c) => c.isCommander)
  const commanderCount = commanders.length

  // Commander count / partner validity
  if (commanderCount === 0) {
    warnings.push("No commander set — hover a card and click the crown icon to designate it.")
  } else if (commanderCount === 2) {
    const check = canCoCommand(commanders[0], commanders[1])
    if (!check.ok) {
      errors.push(check.reason ?? "These two cards cannot be paired as commanders.")
    }
  } else if (commanderCount > 2) {
    errors.push(`Too many commanders (${commanderCount}) — Commander allows at most two.`)
  }

  // Deck size
  if (cardCount !== 100) {
    if (cardCount < 100) warnings.push(`${100 - cardCount} cards short of 100.`)
    else errors.push(`Deck has ${cardCount} cards — trim ${cardCount - 100} to reach 100.`)
  }

  // Singleton / copy-limit enforcement (skip basic lands — they're handled by getDeckLimit returning Infinity)
  const nameTotals = new Map<string, { count: number; card: CardInDeck }>()
  for (const card of cards) {
    if (isBasicLand(card.typeLine, card.name)) continue
    const entry = nameTotals.get(card.name)
    if (entry) {
      entry.count += card.quantity
    } else {
      nameTotals.set(card.name, { count: card.quantity, card })
    }
  }
  for (const [name, { count, card }] of nameTotals) {
    const limit = getDeckLimit(card)
    if (limit === Infinity) continue // "any number" cards are fine
    if (count > limit) {
      if (limit === 1) {
        duplicates.push(name)
      } else {
        errors.push(`Too many copies of ${name}: have ${count}, max ${limit}.`)
      }
    }
  }
  if (duplicates.length > 0) {
    errors.push(`Duplicate cards: ${duplicates.join(", ")}`)
  }

  // Color identity — union of all commanders
  if (commanderCount >= 1) {
    const cmdColors = new Set(getCombinedColorIdentity(commanders))
    for (const card of cards) {
      if (card.isCommander) continue
      if (isBasicLand(card.typeLine, card.name)) continue
      const outside = card.colorIdentity.filter((c) => !cmdColors.has(c))
      if (outside.length > 0) colorViolations.push(card.name)
    }
    if (colorViolations.length > 0) {
      errors.push(
        `Outside color identity: ${colorViolations.slice(0, 3).join(", ")}${colorViolations.length > 3 ? ` +${colorViolations.length - 3} more` : ""}`
      )
    }
  }

  const validCommanderCount = commanderCount === 1 || commanderCount === 2
  return {
    isValid:
      errors.length === 0 &&
      warnings.length === 0 &&
      cardCount === 100 &&
      validCommanderCount,
    cardCount,
    commanderCount,
    duplicates,
    colorViolations,
    errors,
    warnings,
  }
}
