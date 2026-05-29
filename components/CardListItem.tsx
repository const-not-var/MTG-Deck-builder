"use client"

import { useState, useRef } from "react"
import { X, Crown, CircleSlash } from "lucide-react"
import type { CardInDeck } from "@/types"
import { ManaCost } from "./ManaSymbol"
import { HoloCard } from "./HoloCard"
import { isCommanderEligible } from "@/lib/commander"

interface Props {
  card: CardInDeck
  onRemove: (scryfallId: string) => void
  onToggleCommander: (scryfallId: string) => void
  commanderColorIdentity: string[]
  hasCommander: boolean
}

export function CardListItem({ card, onRemove, onToggleCommander, commanderColorIdentity, hasCommander }: Props) {
  const [imgError, setImgError] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleHide = () => {
    hideRef.current = setTimeout(() => setShowPreview(false), 120)
  }
  const cancelHide = () => {
    if (hideRef.current) clearTimeout(hideRef.current)
  }

  const isColorViolation =
    hasCommander &&
    !card.isCommander &&
    !card.typeLine.includes("Basic Land") &&
    card.colorIdentity.some((c) => !commanderColorIdentity.includes(c))

  const accentBorder = isColorViolation
    ? "border-l-2 border-l-red-500/70"
    : card.isCommander
    ? "border-l-2 border-l-amber-500"
    : "border-l-2 border-l-transparent"

  const hoverBg = isColorViolation
    ? "hover:bg-red-500/8"
    : card.isCommander
    ? "hover:bg-amber-500/8"
    : "hover:bg-zinc-800/50"

  const activeBg = isColorViolation
    ? "bg-red-500/5"
    : card.isCommander
    ? "bg-amber-500/5"
    : ""

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-all relative ${accentBorder} ${activeBg} ${hoverBg}`}
    >
      {/* Thumbnail */}
      <div
        className="relative flex-shrink-0 cursor-pointer"
        onMouseEnter={(e) => { cancelHide(); setHoverPos({ x: e.clientX, y: e.clientY }); setShowPreview(true) }}
        onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={scheduleHide}
      >
        {card.imageUri && !imgError ? (
          <img
            src={card.imageUri}
            alt={card.name}
            onError={() => setImgError(true)}
            className="w-9 h-[52px] object-cover object-top rounded-md border border-zinc-700/80 shadow-sm"
          />
        ) : (
          <div className="w-9 h-[52px] bg-zinc-800 rounded-md border border-zinc-700/80 flex items-center justify-center">
            <span className="text-[9px] text-zinc-500 text-center leading-tight px-0.5">
              {card.name.slice(0, 3)}
            </span>
          </div>
        )}
        {card.isCommander && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-md shadow-amber-500/40">
            <Crown className="w-2.5 h-2.5 text-zinc-950" />
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {card.quantity > 1 && (
            <span className="text-xs font-bold text-amber-400 flex-shrink-0">{card.quantity}×</span>
          )}
          <span className={`text-sm font-medium truncate ${isColorViolation ? "text-red-400" : card.isCommander ? "text-amber-100" : "text-zinc-200"}`}>
            {card.name}
            {card.isFoil ? <span className="text-blue-400/80 ml-1 text-xs">✦</span> : null}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-zinc-500 truncate">{card.typeLine.split(" — ")[0]}</span>
          {card.isFoil && card.prices?.usdFoil ? (
            <span className="text-[10px] text-blue-400/80 flex-shrink-0">${card.prices.usdFoil} ✦</span>
          ) : card.prices?.usd ? (
            <span className="text-[10px] text-green-400/70 flex-shrink-0">${card.prices.usd}</span>
          ) : card.prices?.usdFoil ? (
            <span className="text-[10px] text-blue-400/80 flex-shrink-0">${card.prices.usdFoil} ✦</span>
          ) : null}
        </div>
      </div>

      {/* Mana cost */}
      <div className="hidden sm:flex flex-shrink-0">
        {card.manaCost && <ManaCost cost={card.manaCost} />}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isCommanderEligible(card) && (
          <button
            onClick={() => onToggleCommander(card.scryfallId)}
            title={card.isCommander ? "Remove as commander" : "Set as commander"}
            className="p-1.5 rounded-lg hover:bg-zinc-700/80 text-zinc-500 hover:text-amber-400 transition-colors"
          >
            {card.isCommander ? <CircleSlash className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={() => onRemove(card.scryfallId)}
          className="p-1.5 rounded-lg hover:bg-zinc-700/80 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fixed-position HoloCard preview */}
      {showPreview && card.imageUri && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 230),
            top: Math.max(hoverPos.y - 100, 8),
          }}
        >
          <div
            className="bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-700/60 w-52 pointer-events-auto"
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <HoloCard
              src={card.imageUri}
              alt={card.name}
              imgStyle={{ borderRadius: "5%" }}
              imgClassName="w-full"
              foil={!!card.isFoil}
            />
          </div>
        </div>
      )}
    </div>
  )
}
