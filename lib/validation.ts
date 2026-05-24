import type { CardInDeck, DeckValidation } from "@/types"
import { isBasicLand } from "./scryfall"

export function validateDeck(cards: CardInDeck[]): DeckValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const duplicates: string[] = []
  const colorViolations: string[] = []

  const cardCount = cards.reduce((sum, c) => sum + c.quantity, 0)
  const commanders = cards.filter((c) => c.isCommander)
  const commanderCount = commanders.length

  if (commanderCount === 0) {
    warnings.push("No commander set — hover a card and click the crown icon to designate it.")
  } else if (commanderCount > 1) {
    errors.push("You can only have one commander (partner commanders coming soon).")
  }

  if (cardCount !== 100) {
    if (cardCount < 100) warnings.push(`${100 - cardCount} cards short of 100.`)
    else errors.push(`Deck has ${cardCount} cards — trim ${cardCount - 100} to reach 100.`)
  }

  // Check for duplicates (skip basic lands)
  const nameCounts = new Map<string, number>()
  for (const card of cards) {
    if (isBasicLand(card.typeLine, card.name)) continue
    nameCounts.set(card.name, (nameCounts.get(card.name) ?? 0) + card.quantity)
  }
  for (const [name, count] of nameCounts) {
    if (count > 1) duplicates.push(name)
  }
  if (duplicates.length > 0) {
    errors.push(`Duplicate cards: ${duplicates.join(", ")}`)
  }

  // Check color identity
  if (commanderCount === 1) {
    const cmdColors = new Set(commanders[0].colorIdentity)
    for (const card of cards) {
      if (card.isCommander) continue
      if (isBasicLand(card.typeLine, card.name)) continue
      const outside = card.colorIdentity.filter((c) => !cmdColors.has(c))
      if (outside.length > 0) {
        colorViolations.push(card.name)
      }
    }
    if (colorViolations.length > 0) {
      errors.push(`Outside color identity: ${colorViolations.slice(0, 3).join(", ")}${colorViolations.length > 3 ? ` +${colorViolations.length - 3} more` : ""}`)
    }
  }

  return {
    isValid: errors.length === 0 && warnings.length === 0 && cardCount === 100 && commanderCount === 1,
    cardCount,
    commanderCount,
    duplicates,
    colorViolations,
    errors,
    warnings,
  }
}
