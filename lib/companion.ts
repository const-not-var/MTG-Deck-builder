import type { CardInDeck } from "@/types"
import { isBasicLand } from "./scryfall"

// ─── COMMANDER BANLIST ────────────────────────────────────────────────────────
// Source: mtgcommander.net/index.php/banned-list/
export const COMMANDER_BANLIST = new Set([
  "Ancestral Recall",
  "Balance",
  "Biorhythm",
  "Black Lotus",
  "Braids, Cabal Minion",
  "Channel",
  "Coalition Victory",
  "Emrakul, the Aeons Torn",
  "Erayo, Soratami Ascendant",
  "Fastbond",
  "Flash",
  "Gifts Ungiven",
  "Griselbrand",
  "Hullbreacher",
  "Ibrahim, Treacherous",
  "Iona, Shield of Emeria",
  "Karakas",
  "Leovold, Emissary of Trest",
  "Library of Alexandria",
  "Limited Resources",
  "Lutri, the Spellchaser",
  "Mox Emerald",
  "Mox Jet",
  "Mox Pearl",
  "Mox Ruby",
  "Mox Sapphire",
  "Panoptic Mirror",
  "Paradox Engine",
  "Primeval Titan",
  "Prophet of Kruphix",
  "Recurring Nightmare",
  "Rofellos, Llanowar Emissary",
  "Sundering Titan",
  "Sway of the Stars",
  "Time Vault",
  "Time Walk",
  "Tinker",
  "Tolarian Academy",
  "Trade Secrets",
  "Upheaval",
  "Yawgmoth's Bargain",
])

// ─── COMPANION DETECTION ──────────────────────────────────────────────────────

/** True when this card has the Companion keyword (detectable from oracle text). */
export function isCompanionCard(card: CardInDeck): boolean {
  return /^Companion\s*—/m.test(card.oracleText ?? "")
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isLand(card: CardInDeck) {
  return card.typeLine.includes("Land")
}

function isPermanent(card: CardInDeck) {
  return /Creature|Artifact|Enchantment|Planeswalker|Battle|Land/.test(card.typeLine)
}

function isCreature(card: CardInDeck) {
  return card.typeLine.includes("Creature")
}

function hasManaCost(card: CardInDeck) {
  return !!card.manaCost && card.manaCost.trim() !== ""
}

// Check for repeated colored/snow/hybrid mana symbols: {W}{W} fails, {2}{W} passes
function hasDuplicateColoredSymbols(manaCost: string): boolean {
  const symbols = (manaCost.match(/\{([WUBRGCS])\}/gi) ?? []).map(s => s.toUpperCase())
  return new Set(symbols).size < symbols.length
}

// Check for any activated ability ({cost}: effect) in oracle text
function hasActivatedAbility(card: CardInDeck): boolean {
  if (isBasicLand(card.typeLine, card.name)) return true // implied {T}: Add mana
  const o = card.oracleText ?? ""
  return /\{[^}]+\}[^:.\n]*:|\bequip\b|\bcrew\b/i.test(o)
}

function names(cards: CardInDeck[], max = 3): string {
  const head = cards.slice(0, max).map(c => c.name).join(", ")
  const tail = cards.length > max ? ` +${cards.length - max} more` : ""
  return head + tail
}

// ─── COMPANION RESTRICTION VALIDATORS ────────────────────────────────────────

type Validator = (nonCommanderCards: CardInDeck[]) => string | null

const VALIDATORS: Record<string, Validator> = {
  "Lurrus of the Dream-Den": (cards) => {
    const bad = cards.filter(c => isPermanent(c) && !isLand(c) && c.cmc > 2)
    return bad.length ? `Lurrus requires all nonland permanents to have CMC ≤ 2. Offenders: ${names(bad)}.` : null
  },
  "Gyruda, Doom of Depths": (cards) => {
    const bad = cards.filter(c => hasManaCost(c) && c.cmc % 2 !== 0)
    return bad.length ? `Gyruda requires all cards with a mana cost to have even CMC. Offenders: ${names(bad)}.` : null
  },
  "Jegantha, the Wellspring": (cards) => {
    const bad = cards.filter(c => hasDuplicateColoredSymbols(c.manaCost ?? ""))
    return bad.length ? `Jegantha: no card may have repeated mana symbols in its cost. Offenders: ${names(bad)}.` : null
  },
  "Kaheera, the Orphanguard": (cards) => {
    const VALID = ["Cat", "Elemental", "Nightmare", "Dinosaur", "Beast"]
    const bad = cards.filter(c => isCreature(c) && !VALID.some(t => c.typeLine.includes(t)))
    return bad.length ? `Kaheera requires all creatures to be Cats, Elementals, Nightmares, Dinosaurs, or Beasts. Offenders: ${names(bad)}.` : null
  },
  "Keruga, the Macrosage": (cards) => {
    const bad = cards.filter(c => !isLand(c) && c.cmc < 3)
    return bad.length ? `Keruga requires all nonland cards to have CMC ≥ 3. Offenders: ${names(bad)}.` : null
  },
  "Obosh, the Preypiercer": (cards) => {
    const bad = cards.filter(c => hasManaCost(c) && c.cmc % 2 === 0)
    return bad.length ? `Obosh requires all cards with a mana cost to have odd CMC. Offenders: ${names(bad)}.` : null
  },
  "Umori, the Collector": (cards) => {
    const nonLands = cards.filter(c => !isLand(c))
    if (!nonLands.length) return null
    const TYPES = ["Artifact", "Creature", "Enchantment", "Instant", "Planeswalker", "Sorcery"]
    const shared = TYPES.find(t => nonLands.every(c => c.typeLine.includes(t)))
    return shared ? null : "Umori requires all nonland cards to share a card type (Artifact, Creature, Enchantment, Instant, Planeswalker, or Sorcery)."
  },
  // Yorion requires 20 extra cards — in Commander that means 120 cards, which is a non-standard variant.
  // We leave enforcement to the player rather than error.
  "Yorion, Sky Nomad": () => null,
  "Zirda, the Dawnwaker": (cards) => {
    const bad = cards.filter(c => isPermanent(c) && !isLand(c) && !hasActivatedAbility(c))
    return bad.length ? `Zirda requires all nonland permanents to have an activated ability. Offenders: ${names(bad)}.` : null
  },
  "Lutri, the Spellchaser": () => "Lutri, the Spellchaser is banned as a companion in Commander.",
}

/**
 * Validate a companion's deckbuilding restriction against the non-companion,
 * non-commander cards in the deck. Returns an error string or null if valid.
 */
export function validateCompanionRestriction(companion: CardInDeck, allCards: CardInDeck[]): string | null {
  const mainDeck = allCards.filter(c => !c.isCommander && !c.isCompanion)
  const validator = VALIDATORS[companion.name]
  if (!validator) {
    return `${companion.name} has a deckbuilding restriction — verify your deck meets it manually.`
  }
  return validator(mainDeck)
}
