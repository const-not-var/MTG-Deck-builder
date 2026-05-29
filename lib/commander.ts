import type { CardInDeck } from "@/types"

// ─── HOW TO ADD A NEW PARTNER MECHANIC ───────────────────────────────────────
//
// When WotC introduces a new "two commanders" mechanic:
//
//  1. Add a new string literal to PartnerMode below (e.g. "team-up").
//
//  2. In getPartnerMode(), add an oracle-text or type-line check for the new
//     keyword BEFORE the final `return "solo"`.  Keep specific patterns above
//     generic ones (e.g. "Partner with" before "Partner").
//
//  3. In canCoCommand(), add the new pairing rule alongside the existing ones.
//
//  4. In partnerModeLabel(), return a human-readable label for the new mode.
//
// All detection is oracle-text-driven, so newly printed cards that use an
// *existing* keyword (Partner, Friends forever, etc.) work automatically
// without any code changes.
// ─────────────────────────────────────────────────────────────────────────────

export type PartnerMode =
  | "solo"              // normal legendary creature/planeswalker, no partner ability
  | "partner"           // generic "Partner" keyword — pairs with any other Partner card
  | "partner-with"      // "Partner with [Name]" — pairs only with the named card
  | "background"        // "Choose a Background" — pairs with a Background enchantment
  | "is-background"     // Legendary Enchantment — Background type
  | "friends-forever"   // "Friends forever" — pairs with any other Friends forever card
  | "the-doctor"        // Legendary Time Lord Doctor — pairs with Doctor's companion
  | "doctors-companion" // "Doctor's companion" — pairs with a Doctor

export function isCommanderEligible(card: CardInDeck): boolean {
  const t = card.typeLine
  const o = card.oracleText ?? ""
  if (t.includes("Legendary") && t.includes("Creature")) return true
  if (t.includes("Legendary") && t.includes("Planeswalker")) return true
  if (t.includes("Legendary") && t.includes("Enchantment") && t.includes("Background")) return true
  if (o.toLowerCase().includes("can be your commander")) return true
  return false
}

export function getPartnerMode(card: CardInDeck): PartnerMode | null {
  if (!isCommanderEligible(card)) return null
  const o = card.oracleText ?? ""
  const t = card.typeLine

  if (t.includes("Legendary") && t.includes("Enchantment") && t.includes("Background")) {
    return "is-background"
  }
  // Order matters: check specific forms before generic "Partner"
  if (/doctor's companion/i.test(o)) return "doctors-companion"
  if (/Time Lord Doctor/.test(t)) return "the-doctor"
  if (/partner with /i.test(o)) return "partner-with"
  if (/\bpartner\b/i.test(o)) return "partner"
  if (/friends forever/i.test(o)) return "friends-forever"
  if (/choose a background/i.test(o)) return "background"

  return "solo"
}

export function getPartnerWithName(card: CardInDeck): string | null {
  const match = (card.oracleText ?? "").match(/[Pp]artner with ([^(\n]+)/i)
  return match ? match[1].trim().replace(/\.$/, "") : null
}

export function canCoCommand(
  existing: CardInDeck,
  candidate: CardInDeck,
): { ok: boolean; reason?: string } {
  const modeA = getPartnerMode(existing)
  const modeB = getPartnerMode(candidate)

  if (!modeA || !modeB) {
    return { ok: false, reason: `${!modeA ? existing.name : candidate.name} cannot be a commander.` }
  }

  // Generic Partner + generic Partner
  if (modeA === "partner" && modeB === "partner") return { ok: true }

  // Partner with — check each direction
  if (modeA === "partner-with" || modeB === "partner-with") {
    const nameA = modeA === "partner-with" ? getPartnerWithName(existing) : null
    const nameB = modeB === "partner-with" ? getPartnerWithName(candidate) : null
    const aMatchesB = nameA != null && nameA.toLowerCase() === candidate.name.toLowerCase()
    const bMatchesA = nameB != null && nameB.toLowerCase() === existing.name.toLowerCase()
    if (aMatchesB || bMatchesA) return { ok: true }
    const expected = nameA ?? nameB ?? "their named partner"
    return {
      ok: false,
      reason: `Partner with mismatch — ${existing.name} and ${candidate.name} are not each other's named partner (expected ${expected}).`,
    }
  }

  // Choose a Background + Background enchantment
  if (modeA === "background" && modeB === "is-background") return { ok: true }
  if (modeA === "is-background" && modeB === "background") return { ok: true }

  // Friends forever + Friends forever
  if (modeA === "friends-forever" && modeB === "friends-forever") return { ok: true }

  // The Doctor + Doctor's companion
  if (modeA === "the-doctor" && modeB === "doctors-companion") return { ok: true }
  if (modeA === "doctors-companion" && modeB === "the-doctor") return { ok: true }

  return {
    ok: false,
    reason: `${existing.name} and ${candidate.name} cannot be paired as commanders.`,
  }
}

export function getCombinedColorIdentity(commanders: CardInDeck[]): string[] {
  const colors = new Set<string>()
  for (const c of commanders) {
    for (const color of c.colorIdentity) colors.add(color)
  }
  return [...colors]
}

export function partnerModeLabel(mode: PartnerMode): string {
  switch (mode) {
    case "partner":           return "Partner"
    case "partner-with":      return "Partner with"
    case "background":        return "Choose a Background"
    case "is-background":     return "Background"
    case "friends-forever":   return "Friends forever"
    case "the-doctor":        return "The Doctor"
    case "doctors-companion": return "Doctor's companion"
    default:                  return ""
  }
}
