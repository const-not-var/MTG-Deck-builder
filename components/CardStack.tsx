"use client"

import { useState } from "react"
import { X, Crown, CircleSlash } from "lucide-react"
import type { CardInDeck } from "@/types"
import { isCommanderEligible } from "@/lib/commander"
import { getDeckLimit } from "@/lib/rules"
import { HoloCard } from "./HoloCard"

export const CARD_W = 177
export const CARD_H = Math.round(CARD_W * 88 / 63) // ≈ 190
const STACK_OFFSET = 30

function saltColor(s: number): string {
  if (s < 0.5) return "#6b7280"
  if (s < 1.5) return "#22c55e"
  if (s < 2.5) return "#eab308"
  if (s < 3.5) return "#f97316"
  return "#ef4444"
}

interface ItemProps {
  card: CardInDeck
  hovered: boolean
  onHoverChange: (h: boolean) => void
  onRemove: (id: string) => void
  onQuantityChange: (id: string, delta: number) => void
  onToggleCommander: (id: string) => void
  commanderColorIdentity: string[]
  hasCommander: boolean
}

function CardStackItem({
  card,
  hovered,
  onHoverChange,
  onRemove,
  onQuantityChange,
  onToggleCommander,
  commanderColorIdentity,
  hasCommander,
}: ItemProps) {
  const [imgError, setImgError] = useState(false)

  const isColorViolation =
    hasCommander &&
    !card.isCommander &&
    !card.typeLine.includes("Basic Land") &&
    card.colorIdentity.some((c) => !commanderColorIdentity.includes(c))

  const limit = getDeckLimit(card)
  const isMultiCopy = limit !== 1

  const borderColor = isColorViolation
    ? "rgba(239,68,68,0.75)"
    : card.isCommander
    ? "rgba(245,158,11,0.85)"
    : "transparent"

  const shadow = isColorViolation
    ? `0 0 14px rgba(239,68,68,0.30), ${hovered ? "0 20px 48px rgba(0,0,0,0.9)" : "0 4px 12px rgba(0,0,0,0.5)"}`
    : card.isCommander
    ? `0 0 18px rgba(245,158,11,0.35), ${hovered ? "0 20px 48px rgba(0,0,0,0.9)" : "0 4px 12px rgba(0,0,0,0.5)"}`
    : hovered
    ? "0 20px 48px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.6)"
    : "0 4px 12px rgba(0,0,0,0.5)"

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        position: "relative",
        transform: hovered ? "translateY(-10px)" : "translateY(0)",
        transition: "transform 0.18s ease",
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: "7px",
          overflow: "hidden",
          border: borderColor !== "transparent" ? `1.5px solid ${borderColor}` : "none",
          boxShadow: shadow,
          position: "relative",
          transition: "box-shadow 0.18s ease",
        }}
      >
        {/* Card image */}
        {card.imageUri && !imgError ? (
          card.isFoil ? (
            <HoloCard
              src={card.imageUri}
              alt={card.name}
              className="w-full h-full"
              imgClassName="object-cover object-top select-none"
              imgStyle={{ borderRadius: 0 }}
              foil={true}
            />
          ) : (
            <img
              src={card.imageUri}
              alt={card.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-top select-none"
              draggable={false}
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center p-2 text-center" style={{ background: "#1a1a2e" }}>
            <span className="text-[10px] text-zinc-400 leading-snug">{card.name}</span>
          </div>
        )}

        {/* Quantity badge — top left */}
        {card.quantity > 1 && (
          <div
            className="absolute top-1.5 left-1.5 text-[10px] font-bold text-amber-300 tabular-nums px-1.5 py-0.5 rounded-md leading-none"
            style={{ background: "rgba(0,0,0,0.82)" }}
          >
            {card.quantity}×
          </div>
        )}

        {/* Commander crown badge — top right */}
        {card.isCommander && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50">
            <Crown className="w-3 h-3 text-zinc-950" />
          </div>
        )}

        {/* Foil badge */}
        {card.isFoil && (
          <div
            className="absolute top-1.5 text-[9px] text-blue-300 font-bold px-1.5 py-0.5 rounded leading-none"
            style={{ right: card.isCommander ? "28px" : "6px", background: "rgba(0,0,0,0.75)" }}
          >
            ✦
          </div>
        )}

        {/* Art-area action buttons — visible on hover */}
        {hovered && (
          <>
            {/* X delete — right side of art box */}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(card.scryfallId) }}
              title="Remove card"
              className="absolute right-1.5"
              style={{
                top: "33%",
                background: "rgba(0,0,0,0.78)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "6px",
                padding: "4px",
                lineHeight: 0,
              }}
            >
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>

            {/* Crown toggle — left side of art box */}
            {isCommanderEligible(card) && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCommander(card.scryfallId) }}
                title={card.isCommander ? "Remove as commander" : "Set as commander"}
                className="absolute left-1.5"
                style={{
                  top: "33%",
                  background: "rgba(0,0,0,0.78)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "6px",
                  padding: "4px",
                  lineHeight: 0,
                }}
              >
                {card.isCommander
                  ? <CircleSlash className="w-3.5 h-3.5 text-amber-400" />
                  : <Crown className="w-3.5 h-3.5 text-amber-400" />
                }
              </button>
            )}

            {/* Quantity controls — centered in art box */}
            {isMultiCopy && (
              <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1"
                style={{ top: "58%" }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onQuantityChange(card.scryfallId, -1) }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: "rgba(0,0,0,0.80)", border: "1px solid rgba(255,255,255,0.15)" }}
                >−</button>
                <span className="text-xs font-bold text-white w-4 text-center tabular-nums">{card.quantity}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onQuantityChange(card.scryfallId, +1) }}
                  title={limit === Infinity ? "Add one more" : `Max ${limit}`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: "rgba(0,0,0,0.80)", border: "1px solid rgba(255,255,255,0.15)" }}
                >+</button>
              </div>
            )}
          </>
        )}

        {/* Bottom gradient — price + salt */}
        <div
          className="absolute bottom-0 inset-x-0 px-2 pb-2 pt-5"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)" }}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {card.isFoil && card.prices?.usdFoil ? (
              <span className="text-[9px] text-blue-400/90 tabular-nums">${card.prices.usdFoil}</span>
            ) : card.prices?.usd ? (
              <span className="text-[9px] text-green-400/90 tabular-nums">${card.prices.usd}</span>
            ) : null}
            {card.salt !== undefined && (
              <span className="text-[9px] font-bold tabular-nums" style={{ color: saltColor(card.salt) }}>
                🧂{card.salt.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export interface CardStackProps {
  cards: CardInDeck[]
  onRemove: (id: string) => void
  onQuantityChange: (id: string, delta: number) => void
  onToggleCommander: (id: string) => void
  commanderColorIdentity: string[]
  hasCommander: boolean
}

export function CardStack({
  cards,
  onRemove,
  onQuantityChange,
  onToggleCommander,
  commanderColorIdentity,
  hasCommander,
}: CardStackProps) {
  // Hover state lives here so we can apply z-index to the WRAPPER div.
  // If z-index were set inside CardStackItem, the wrapper's stacking context
  // would still win, keeping the hovered card buried behind higher-index siblings.
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const stackH = cards.length <= 1 ? CARD_H : (cards.length - 1) * STACK_OFFSET + CARD_H

  return (
    <div style={{ width: CARD_W, height: stackH, position: "relative" }}>
      {cards.map((card, i) => (
        <div
          key={card.scryfallId}
          style={{
            position: "absolute",
            top: i * STACK_OFFSET,
            left: 0,
            // z-index on THIS div is what actually controls stacking order.
            zIndex: hoveredId === card.scryfallId ? 999 : i + 1,
            transition: "z-index 0s",
          }}
        >
          <CardStackItem
            card={card}
            hovered={hoveredId === card.scryfallId}
            onHoverChange={(h) => setHoveredId(h ? card.scryfallId : null)}
            onRemove={onRemove}
            onQuantityChange={onQuantityChange}
            onToggleCommander={onToggleCommander}
            commanderColorIdentity={commanderColorIdentity}
            hasCommander={hasCommander}
          />
        </div>
      ))}
    </div>
  )
}
