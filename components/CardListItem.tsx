"use client"

import { useState } from "react"
import { X, Crown, CircleSlash } from "lucide-react"
import type { CardInDeck } from "@/types"
import { ManaCost } from "./ManaSymbol"
import { HoloCard } from "./HoloCard"

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

  const isColorViolation =
    hasCommander &&
    !card.isCommander &&
    !card.typeLine.includes("Basic Land") &&
    card.colorIdentity.some((c) => !commanderColorIdentity.includes(c))

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/60 transition-colors relative ${
        isColorViolation ? "bg-red-950/20" : ""
      } ${card.isCommander ? "bg-amber-950/20" : ""}`}
    >
      {/* Thumbnail */}
      <div
        className="relative flex-shrink-0 cursor-pointer"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
      >
        {card.imageUri && !imgError ? (
          <HoloCard
            src={card.imageUri}
            alt={card.name}
            className="w-8 h-11 rounded-sm border border-zinc-700 overflow-hidden"
            imgClassName="object-cover object-top"
            imgStyle={{ borderRadius: "2px" }}
          />
        ) : (
          <div className="w-8 h-11 bg-zinc-700 rounded-sm border border-zinc-700 flex items-center justify-center">
            <span className="text-[9px] text-zinc-500 text-center leading-tight px-0.5">{card.name.slice(0, 3)}</span>
          </div>
        )}
        {card.isCommander && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center">
            <Crown className="w-2 h-2 text-zinc-950" />
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {card.quantity > 1 && (
            <span className="text-xs font-bold text-amber-400 flex-shrink-0">{card.quantity}×</span>
          )}
          <span className={`text-sm truncate ${isColorViolation ? "text-red-400" : "text-zinc-200"}`}>
            {card.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-zinc-500 truncate">{card.typeLine.split(" — ")[0]}</span>
          {card.prices?.usd ? (
            <span className="text-[10px] text-green-400/80 flex-shrink-0">${card.prices.usd}</span>
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
        <button
          onClick={() => onToggleCommander(card.scryfallId)}
          title={card.isCommander ? "Remove as commander" : "Set as commander"}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-amber-400 transition-colors"
        >
          {card.isCommander ? <CircleSlash className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onRemove(card.scryfallId)}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Full card preview on hover */}
      {showPreview && card.imageUri && (
        <div className="absolute left-10 top-0 z-50 pointer-events-none w-48 shadow-2xl rounded-xl overflow-hidden border border-zinc-700">
          <img src={card.imageUri} alt={card.name} className="w-full" />
        </div>
      )}
    </div>
  )
}
