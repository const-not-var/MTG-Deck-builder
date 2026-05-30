"use client"

import { useState, useRef } from "react"
import { X, Crown, CircleSlash } from "lucide-react"
import type { CardInDeck } from "@/types"
import { HoloCard } from "./HoloCard"
import { isCommanderEligible } from "@/lib/commander"
import { getDeckLimit } from "@/lib/rules"

interface Props {
  card: CardInDeck
  onRemove: (scryfallId: string) => void
  onQuantityChange: (scryfallId: string, delta: number) => void
  onToggleCommander: (scryfallId: string) => void
  commanderColorIdentity: string[]
  hasCommander: boolean
}

function saltColor(s: number): string {
  if (s < 0.5) return "#6b7280"
  if (s < 1.5) return "#22c55e"
  if (s < 2.5) return "#eab308"
  if (s < 3.5) return "#f97316"
  return "#ef4444"
}

function saltLabel(s: number): string {
  if (s < 0.5) return "Harmless"
  if (s < 1.5) return "Mild"
  if (s < 2.5) return "Moderate"
  if (s < 3.5) return "High"
  return "Very salty"
}

function SaltPill({ salt }: { salt: number }) {
  const color = saltColor(salt)
  return (
    <span
      title={`Salt score ${salt.toFixed(2)} — ${saltLabel(salt)}\nSource: EDHREC`}
      className="text-[9px] font-bold tabular-nums flex-shrink-0 px-1 py-0.5 rounded cursor-default select-none"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}35`,
        color,
      }}
    >
      🧂{salt.toFixed(1)}
    </span>
  )
}

export function CardListItem({ card, onRemove, onQuantityChange, onToggleCommander, commanderColorIdentity, hasCommander }: Props) {
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

  // Cards that can have more than 1 copy show quantity controls
  const limit = getDeckLimit(card)
  const isMultiCopy = limit !== 1

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
            className="w-10 h-[58px] object-cover object-top rounded-md shadow-sm"
            style={{
              border: card.isCommander
                ? "1px solid rgba(245,158,11,0.5)"
                : "1px solid rgba(255,255,255,0.10)",
              boxShadow: card.isCommander ? "0 0 8px rgba(245,158,11,0.20)" : undefined,
            }}
          />
        ) : (
          <div
            className="w-10 h-[58px] rounded-md flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
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
            <span className="text-xs font-bold text-amber-400 flex-shrink-0 tabular-nums">
              {card.quantity}×
            </span>
          )}
          <span
            className={`text-sm font-medium truncate ${
              isColorViolation ? "text-red-400" : card.isCommander ? "text-amber-100" : "text-zinc-200"
            }`}
          >
            {card.name}
            {card.isFoil ? <span className="text-blue-400/80 ml-1 text-xs">✦</span> : null}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {card.isFoil && card.prices?.usdFoil ? (
            <span className="text-[10px] text-blue-400/80 flex-shrink-0">${card.prices.usdFoil} ✦</span>
          ) : card.prices?.usd ? (
            <span className="text-[10px] text-green-400/70 flex-shrink-0">${card.prices.usd}</span>
          ) : card.prices?.usdFoil ? (
            <span className="text-[10px] text-blue-400/80 flex-shrink-0">${card.prices.usdFoil} ✦</span>
          ) : null}
          {card.salt !== undefined && <SaltPill salt={card.salt} />}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {/* Quantity controls for basic lands and "any number" cards */}
        {isMultiCopy && (
          <>
            <button
              onClick={() => onQuantityChange(card.scryfallId, -1)}
              title="Remove one copy"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/80 text-zinc-500 hover:text-zinc-200 transition-colors text-sm font-bold leading-none"
            >
              −
            </button>
            <button
              onClick={() => onQuantityChange(card.scryfallId, +1)}
              title={limit === Infinity ? "Add one more copy" : `Add one more (max ${limit})`}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/80 text-zinc-500 hover:text-zinc-200 transition-colors text-sm font-bold leading-none"
            >
              +
            </button>
          </>
        )}

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
          title="Remove all copies"
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
