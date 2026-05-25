"use client"

import { AlertCircle, CheckCircle2, AlertTriangle, DollarSign } from "lucide-react"
import type { CardInDeck, DeckValidation } from "@/types"
import { ColorPip } from "./ManaSymbol"
import { ManaCurve } from "./ManaCurve"

const CARD_TYPES = [
  { label: "Creatures", test: (c: CardInDeck) => c.typeLine.includes("Creature") && !c.typeLine.includes("Land") },
  { label: "Planeswalkers", test: (c: CardInDeck) => c.typeLine.includes("Planeswalker") && !c.typeLine.includes("Creature") },
  { label: "Instants", test: (c: CardInDeck) => c.typeLine.includes("Instant") },
  { label: "Sorceries", test: (c: CardInDeck) => c.typeLine.includes("Sorcery") },
  { label: "Artifacts", test: (c: CardInDeck) => c.typeLine.includes("Artifact") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Enchantment") },
  { label: "Enchantments", test: (c: CardInDeck) => c.typeLine.includes("Enchantment") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Artifact") },
  { label: "Lands", test: (c: CardInDeck) => c.typeLine.includes("Land") },
]

interface Props {
  cards: CardInDeck[]
  validation: DeckValidation
}

export function DeckStats({ cards, validation }: Props) {
  const totalPrice = cards.reduce((s, c) => {
    const p = parseFloat(c.prices?.usd ?? c.prices?.usdFoil ?? "0")
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0)

  const commander = cards.find((c) => c.isCommander)
  const colorIdentity = commander?.colorIdentity ?? []
  const nonLandCount = cards.filter((c) => !c.typeLine.includes("Land")).reduce((s, c) => s + c.quantity, 0)
  const avgCmc = nonLandCount > 0
    ? cards.filter((c) => !c.typeLine.includes("Land")).reduce((s, c) => s + c.cmc * c.quantity, 0) / nonLandCount
    : 0

  const progress = Math.min((validation.cardCount / 100) * 100, 100)
  const progressColor = validation.cardCount === 100 ? "bg-green-500" : validation.cardCount > 100 ? "bg-red-500" : "bg-amber-500"

  return (
    <div className="space-y-4">
      {/* Card count progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-zinc-400">Deck Size</span>
          <span className={`text-sm font-bold ${validation.cardCount === 100 ? "text-green-400" : validation.cardCount > 100 ? "text-red-400" : "text-zinc-200"}`}>
            {validation.cardCount}/100
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Total value */}
      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
        <span className="text-xs text-zinc-400 flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5" /> Total Value
        </span>
        <span className="text-sm font-semibold text-green-400">${totalPrice.toFixed(2)}</span>
      </div>

      {/* Color identity */}
      {colorIdentity.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Color Identity</p>
          <div className="flex gap-1.5 flex-wrap">
            {colorIdentity.length === 0
              ? <span className="text-xs text-zinc-600">Colorless</span>
              : colorIdentity.map((c) => <ColorPip key={c} color={c} />)
            }
          </div>
        </div>
      )}

      {/* Avg CMC */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Avg. Mana Value</span>
        <span className="text-sm text-zinc-300">{avgCmc.toFixed(2)}</span>
      </div>

      {/* Mana curve */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Mana Curve</p>
        <ManaCurve cards={cards} />
      </div>

      {/* Type breakdown */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Type Breakdown</p>
        <div className="space-y-1">
          {CARD_TYPES.map(({ label, test }) => {
            const count = cards.filter(test).reduce((s, c) => s + c.quantity, 0)
            if (count === 0) return null
            return (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">{label}</span>
                <span className="text-zinc-300 font-medium">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Validation messages */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-1.5">
          {validation.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-400 bg-red-950/30 rounded-md px-2 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{e}</span>
            </div>
          ))}
          {validation.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400 bg-yellow-950/30 rounded-md px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
          {validation.isValid && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-950/30 rounded-md px-2 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Deck is tournament-legal!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
