import type { CardInDeck, DeckValidation } from "@/types"
import { isBasicLand } from "./scryfall"
import { canCoCommand, getCombinedColorIdentity } from "./commander"
import { getDeckLimit } from "./rules"
import { isCompanionCard, validateCompanionRestriction, COMMANDER_BANLIST } from "./companion"

export function validateDeck(cards: CardInDeck[]): DeckValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const duplicates: string[] = []
  const colorViolations: string[] = []

  const companions = cards.filter((c) => c.isCompanion)
  const commanders = cards.filter((c) => c.isCommander)
  const commanderCount = commanders.length

  // Companion is outside the 100 — exclude it from the card count
  const cardCount = cards.filter(c => !c.isCompanion).reduce((sum, c) => sum + c.quantity, 0)

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

  // Companion validation
  if (companions.length > 1) {
    errors.push(`Too many companions (${companions.length}) — a deck can have at most one.`)
  } else if (companions.length === 1) {
    const companion = companions[0]
    if (!isCompanionCard(companion)) {
      errors.push(`${companion.name} does not have the Companion ability.`)
    }
    // Companion must be within the commander's color identity
    if (commanderCount >= 1) {
      const cmdColors = new Set(getCombinedColorIdentity(commanders))
      const outside = companion.colorIdentity.filter(c => !cmdColors.has(c))
      if (outside.length > 0) {
        errors.push(`Companion ${companion.name} is outside your commander's color identity.`)
      }
    }
    // Deckbuilding restriction
    const restrictionError = validateCompanionRestriction(companion, cards)
    if (restrictionError) errors.push(restrictionError)
  }

  // Deck size (companion excluded)
  if (cardCount !== 100) {
    if (cardCount < 100) warnings.push(`${100 - cardCount} cards short of 100.`)
    else errors.push(`Deck has ${cardCount} cards — trim ${cardCount - 100} to reach 100.`)
  }

  // Singleton / copy-limit enforcement
  const nameTotals = new Map<string, { count: number; card: CardInDeck }>()
  for (const card of cards) {
    if (card.isCompanion) continue // companion is outside the deck
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
    if (limit === Infinity) continue
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

  // Color identity — union of all commanders (companion already checked above)
  if (commanderCount >= 1) {
    const cmdColors = new Set(getCombinedColorIdentity(commanders))
    for (const card of cards) {
      if (card.isCommander || card.isCompanion) continue
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

  // Banlist check
  const banned = cards.filter(c => COMMANDER_BANLIST.has(c.name))
  if (banned.length > 0) {
    errors.push(`Banned in Commander: ${banned.map(c => c.name).join(", ")}`)
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
