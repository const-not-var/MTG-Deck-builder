"use client"

import { AlertCircle, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react"
import type { CardInDeck, DeckValidation } from "@/types"
import { ColorPip } from "./ManaSymbol"
import { ManaCurve } from "./ManaCurve"
import { getCombinedColorIdentity, getPartnerMode, partnerModeLabel } from "@/lib/commander"

const CARD_TYPES = [
  { label: "Creatures",     color: "bg-green-500",  test: (c: CardInDeck) => c.typeLine.includes("Creature") && !c.typeLine.includes("Land") },
  { label: "Planeswalkers", color: "bg-purple-500", test: (c: CardInDeck) => c.typeLine.includes("Planeswalker") && !c.typeLine.includes("Creature") },
  { label: "Instants",      color: "bg-blue-500",   test: (c: CardInDeck) => c.typeLine.includes("Instant") },
  { label: "Sorceries",     color: "bg-red-500",    test: (c: CardInDeck) => c.typeLine.includes("Sorcery") },
  { label: "Artifacts",     color: "bg-zinc-400",   test: (c: CardInDeck) => c.typeLine.includes("Artifact") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Enchantment") },
  { label: "Enchantments",  color: "bg-amber-500",  test: (c: CardInDeck) => c.typeLine.includes("Enchantment") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Artifact") },
  { label: "Lands",         color: "bg-orange-700", test: (c: CardInDeck) => c.typeLine.includes("Land") },
]

interface Props {
  cards: CardInDeck[]
  validation: DeckValidation
}

export function DeckStats({ cards, validation }: Props) {
  const totalPrice = cards.reduce((s, c) => {
    const p = parseFloat((c.isFoil ? c.prices?.usdFoil : c.prices?.usd) ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0)

  const commanders = cards.filter((c) => c.isCommander)
  const colorIdentity = getCombinedColorIdentity(commanders)
  const nonLandCards = cards.filter((c) => !c.typeLine.includes("Land"))
  const nonLandCount = nonLandCards.reduce((s, c) => s + c.quantity, 0)
  const avgCmc = nonLandCount > 0
    ? nonLandCards.reduce((s, c) => s + c.cmc * c.quantity, 0) / nonLandCount
    : 0

  const progress = Math.min((validation.cardCount / 100) * 100, 100)
  const isComplete = validation.cardCount === 100
  const isOver = validation.cardCount > 100

  const typeCounts = CARD_TYPES.map(({ label, color, test }) => ({
    label, color,
    count: cards.filter(test).reduce((s, c) => s + c.quantity, 0),
  })).filter((t) => t.count > 0)

  const maxTypeCount = Math.max(...typeCounts.map((t) => t.count), 1)

  return (
    <div className="space-y-5">
      {/* Card count */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-400">Deck Size</span>
          <span className={`text-sm font-bold tabular-nums ${isComplete ? "text-green-400" : isOver ? "text-red-400" : "text-zinc-200"}`}>
            {validation.cardCount}<span className="text-zinc-600 font-normal">/100</span>
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-green-500" : isOver ? "bg-red-500" : "bg-amber-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Total value */}
      <div className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-3.5 py-2.5">
        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Total Value
        </span>
        <span className="text-sm font-semibold text-green-400 tabular-nums">${totalPrice.toFixed(2)}</span>
      </div>

      {/* Commander(s) */}
      {commanders.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
            {commanders.length === 2 ? "Commanders" : "Commander"}
          </p>
          <div className="space-y-1 mb-2.5">
            {commanders.map((c) => {
              const mode = getPartnerMode(c)
              const label = mode && mode !== "solo" ? partnerModeLabel(mode) : null
              return (
                <div key={c.scryfallId} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-300 truncate">{c.name}</span>
                  {label && (
                    <span className="text-[10px] text-amber-400/80 flex-shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/15">
                      {label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {colorIdentity.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {colorIdentity.map((c) => <ColorPip key={c} color={c} />)}
            </div>
          )}
        </div>
      )}

      {/* Avg CMC */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Avg. Mana Value</span>
        <span className="text-sm font-medium text-zinc-300 tabular-nums">{avgCmc.toFixed(2)}</span>
      </div>

      {/* Mana curve */}
      <div>
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2.5">Mana Curve</p>
        <ManaCurve cards={cards} />
      </div>

      {/* Type breakdown */}
      {typeCounts.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2.5">Type Breakdown</p>
          <div className="space-y-2">
            {typeCounts.map(({ label, color, count }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">{label}</span>
                  <span className="text-zinc-300 font-medium tabular-nums">{count}</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${(count / maxTypeCount) * 100}%`, opacity: 0.7 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation messages */}
      {(validation.errors.length > 0 || validation.warnings.length > 0 || validation.isValid) && (
        <div className="space-y-1.5">
          {validation.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{e}</span>
            </div>
          ))}
          {validation.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/8 border border-yellow-500/15 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
          {validation.isValid && (
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/8 border border-green-500/15 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              Tournament legal!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
