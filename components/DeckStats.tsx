"use client"

import { useMemo } from "react"
import { AlertCircle, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react"
import type { CardInDeck, DeckValidation } from "@/types"
import { ManaCurve } from "./ManaCurve"
import { getPartnerMode, partnerModeLabel } from "@/lib/commander"

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
  const totalPrice = useMemo(() => cards.reduce((s, c) => {
    const p = parseFloat((c.isFoil ? c.prices?.usdFoil : c.prices?.usd) ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0), [cards])

  const commanders = useMemo(() => cards.filter((c) => c.isCommander), [cards])

  const { avgCmc } = useMemo(() => {
    const nonLand = cards.filter((c) => !c.typeLine.includes("Land"))
    const count = nonLand.reduce((s, c) => s + c.quantity, 0)
    const avg = count > 0 ? nonLand.reduce((s, c) => s + c.cmc * c.quantity, 0) / count : 0
    return { avgCmc: avg }
  }, [cards])

  const typeCounts = useMemo(() => {
    const counts = CARD_TYPES.map(({ label, color, test }) => ({
      label, color,
      count: cards.filter(test).reduce((s, c) => s + c.quantity, 0),
    })).filter((t) => t.count > 0)
    return counts
  }, [cards])

  const saltStats = useMemo(() => {
    const salted = cards.filter((c) => c.salt !== undefined)
    const total = salted.reduce((s, c) => s + (c.salt ?? 0), 0)
    const avg = salted.length > 0 ? total / salted.length : 0
    const pct = Math.min((total / 50) * 100, 100)
    const color = total < 7 ? "#22c55e" : total < 15 ? "#14b8a6" : total < 25 ? "#eab308" : total < 40 ? "#f97316" : "#ef4444"
    const label = total < 7 ? "Pristine" : total < 15 ? "Casual" : total < 25 ? "Focused" : total < 40 ? "Competitive" : "Very Salty"
    const top3 = [...salted].sort((a, b) => (b.salt ?? 0) - (a.salt ?? 0)).slice(0, 3)
    return { salted, total, avg, pct, color, label, top3 }
  }, [cards])

  const maxTypeCount = useMemo(() => Math.max(...typeCounts.map((t) => t.count), 1), [typeCounts])

  const progress = Math.min((validation.cardCount / 100) * 100, 100)
  const isComplete = validation.cardCount === 100
  const isOver = validation.cardCount > 100

  const primaryCommander = commanders[0]
  const artCropUri = primaryCommander?.imageUri?.replace("/normal/", "/art_crop/")

  return (
    <div>
      {/* Commander art hero */}
      {primaryCommander && artCropUri ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <img
            src={artCropUri}
            alt={primaryCommander.name}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to top, rgba(6,7,30,1) 0%, rgba(6,7,30,0.55) 45%, rgba(6,7,30,0.10) 100%)",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                {commanders.map((c) => {
                  const mode = getPartnerMode(c)
                  const label = mode && mode !== "solo" ? partnerModeLabel(mode) : null
                  return (
                    <div key={c.scryfallId} className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-bold text-white truncate leading-snug">{c.name}</p>
                      {label && (
                        <span className="text-[9px] text-amber-300/80 flex-shrink-0 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-8 mx-4 mt-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs text-zinc-600 text-center">No commander set</p>
          <p className="text-[10px] text-zinc-700 mt-0.5">Hover a card and click the crown</p>
        </div>
      )}

    <div className="p-4 space-y-5">
      {/* Card count + progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500">Deck Size</span>
          <span className={`text-sm font-bold tabular-nums ${isComplete ? "text-green-400" : isOver ? "text-red-400" : "text-zinc-200"}`}>
            {validation.cardCount}<span className="text-zinc-600 font-normal">/100</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-green-500" : isOver ? "bg-red-500" : "bg-amber-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Total value */}
      <div
        className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Total Value
        </span>
        <span className="text-sm font-semibold text-green-400 tabular-nums">${totalPrice.toFixed(2)}</span>
      </div>

      {/* Deck salt */}
      <div className="rounded-xl p-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">🧂 Deck Salt</p>
            <p className="text-[10px] text-zinc-600">via EDHREC</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums leading-none"
              style={{ color: saltStats.salted.length > 0 ? saltStats.color : "#52525b" }}>
              {saltStats.salted.length > 0 ? saltStats.total.toFixed(1) : "—"}
            </p>
            <p className="text-[10px] mt-0.5"
              style={{ color: saltStats.salted.length > 0 ? saltStats.color : "#52525b" }}>
              {saltStats.salted.length > 0 ? saltStats.label : "loading…"}
            </p>
          </div>
        </div>

        {saltStats.salted.length > 0 && (
          <>
            <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${saltStats.pct}%`, backgroundColor: saltStats.color }} />
            </div>
            <p className="text-[10px] text-zinc-600">avg {saltStats.avg.toFixed(2)}/card</p>
            {saltStats.top3.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Saltiest Cards</p>
                {saltStats.top3.map((c) => {
                  const sc = (c.salt ?? 0) < 1.0 ? "#22c55e" : (c.salt ?? 0) < 1.8 ? "#eab308" : (c.salt ?? 0) < 2.5 ? "#f97316" : "#ef4444"
                  return (
                    <div key={c.scryfallId} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-400 truncate">{c.name}</span>
                      <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: sc }}>
                        {(c.salt ?? 0).toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
        {saltStats.salted.length === 0 && cards.length > 0 && (
          <p className="text-[10px] text-zinc-600 text-center py-1">Fetching salt scores…</p>
        )}
      </div>

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
    </div>
  )
}
