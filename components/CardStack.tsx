"use client"

import { useState, useEffect, useRef } from "react"
import { X, Crown, CircleSlash, FlipHorizontal2, Anchor } from "lucide-react"
import type { CardInDeck } from "@/types"
import { isCommanderEligible } from "@/lib/commander"
import { isCompanionCard } from "@/lib/companion"
import { getDeckLimit } from "@/lib/rules"
import { scryfallImage } from "@/lib/scryfall"
import { HoloCard } from "./HoloCard"

export const CARD_W = 177
export const CARD_H = Math.round(CARD_W * 88 / 63)
const STACK_OFFSET = 30

function saltColor(s: number): string {
  if (s < 0.3) return "#6b7280"
  if (s < 1.0) return "#22c55e"
  if (s < 1.8) return "#eab308"
  if (s < 2.5) return "#f97316"
  return "#ef4444"
}

function tcgPlayerUrl(card: CardInDeck) {
  return card.tcgplayerUrl ?? `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(card.name)}&view=grid`
}


interface CtxMenu { card: CardInDeck; activeUri: string; x: number; y: number }

interface ItemProps {
  card: CardInDeck
  hovered: boolean
  onHoverChange: (h: boolean) => void
  onRemove: (id: string) => void
  onQuantityChange: (id: string, delta: number) => void
  onToggleCommander: (id: string) => void
  onToggleCompanion: (id: string) => void
  onContextMenu: (card: CardInDeck, activeUri: string, x: number, y: number) => void
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
  onToggleCompanion,
  onContextMenu,
  commanderColorIdentity,
  hasCommander,
}: ItemProps) {
  const [imgError, setImgError] = useState(false)
  const [flipped, setFlipped] = useState(false)

  const hasTwoFaces = !!card.imageUriBack
  const displayUri = scryfallImage(hasTwoFaces && flipped ? card.imageUriBack! : card.imageUri, "large")

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
    : card.isCompanion
    ? "rgba(129,140,248,0.85)"
    : "transparent"

  const shadow = isColorViolation
    ? `0 0 14px rgba(239,68,68,0.30), ${hovered ? "0 20px 48px rgba(0,0,0,0.9)" : "0 4px 12px rgba(0,0,0,0.5)"}`
    : card.isCommander
    ? `0 0 18px rgba(245,158,11,0.35), ${hovered ? "0 20px 48px rgba(0,0,0,0.9)" : "0 4px 12px rgba(0,0,0,0.5)"}`
    : card.isCompanion
    ? `0 0 18px rgba(129,140,248,0.35), ${hovered ? "0 20px 48px rgba(0,0,0,0.9)" : "0 4px 12px rgba(0,0,0,0.5)"}`
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
      onContextMenu={(e) => {
        if (!hovered) return
        e.preventDefault()
        // Clamp so the menu doesn't go off-screen (menu is ~170px wide, ~120px tall)
        const mx = Math.min(e.clientX, window.innerWidth  - 176)
        const my = Math.min(e.clientY, window.innerHeight - 126)
        onContextMenu(card, displayUri, mx, my)
      }}
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
        {displayUri && !imgError ? (
          card.isFoil && !flipped ? (
            <HoloCard
              src={displayUri}
              alt={card.name}
              className="w-full h-full"
              imgClassName="object-cover object-top select-none"
              imgStyle={{ borderRadius: 0 }}
              foil={true}
            />
          ) : (
            <img
              src={displayUri}
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

        {/* Art-area action buttons — visible on hover */}
        {hovered && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(card.scryfallId) }}
              title="Remove card"
              className="absolute right-1.5"
              style={{ top: "33%", background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px", lineHeight: 0 }}
            >
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>

            {hasTwoFaces && (
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped((f) => !f) }}
                title={flipped ? "Show front face" : "Show back face"}
                className="absolute right-1.5"
                style={{ top: "calc(33% + 32px)", background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px", lineHeight: 0 }}
              >
                <FlipHorizontal2 className="w-3.5 h-3.5 text-sky-400" />
              </button>
            )}

            {isCommanderEligible(card) && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCommander(card.scryfallId) }}
                title={card.isCommander ? "Remove as commander" : "Set as commander"}
                className="absolute left-1.5"
                style={{ top: "33%", background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px", lineHeight: 0 }}
              >
                {card.isCommander
                  ? <CircleSlash className="w-3.5 h-3.5 text-amber-400" />
                  : <Crown className="w-3.5 h-3.5 text-amber-400" />
                }
              </button>
            )}

            {isCompanionCard(card) && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCompanion(card.scryfallId) }}
                title={card.isCompanion ? "Remove as companion" : "Set as companion"}
                className="absolute left-1.5"
                style={{ top: "calc(33% + 32px)", background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px", lineHeight: 0 }}
              >
                {card.isCompanion
                  ? <CircleSlash className="w-3.5 h-3.5 text-indigo-400" />
                  : <Anchor className="w-3.5 h-3.5 text-indigo-400" />
                }
              </button>
            )}

            {isMultiCopy && (
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1" style={{ top: "58%" }}>
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
  onToggleCompanion: (id: string) => void
  commanderColorIdentity: string[]
  hasCommander: boolean
}

export function CardStack({
  cards,
  onRemove,
  onQuantityChange,
  onToggleCommander,
  onToggleCompanion,
  commanderColorIdentity,
  hasCommander,
}: CardStackProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [zoomed, setZoomed] = useState<{ card: CardInDeck; uri: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setCtxMenu(null)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [ctxMenu])

  const stackH = cards.length <= 1 ? CARD_H : (cards.length - 1) * STACK_OFFSET + CARD_H

  return (
    <>
      <div style={{ width: CARD_W, height: stackH, position: "relative" }}>
        {cards.map((card, i) => (
          <div
            key={card.scryfallId}
            style={{
              position: "absolute",
              top: i * STACK_OFFSET,
              left: 0,
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
              onToggleCompanion={onToggleCompanion}
              onContextMenu={(c, uri, x, y) => setCtxMenu({ card: c, activeUri: uri, x, y })}
              commanderColorIdentity={commanderColorIdentity}
              hasCommander={hasCommander}
            />
          </div>
        ))}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="fixed z-[9999] rounded-xl shadow-2xl overflow-hidden py-1"
          style={{ left: ctxMenu.x, top: ctxMenu.y, background: "#18181f", border: "1px solid rgba(255,255,255,0.10)", minWidth: 170 }}
        >
          <button
            onClick={() => { setZoomed({ card: ctxMenu.card, uri: ctxMenu.activeUri }); setCtxMenu(null) }}
            className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white transition-colors"
          >
            Zoom Card
          </button>
          <a
            href={tcgPlayerUrl(ctxMenu.card)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setCtxMenu(null)}
            className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white transition-colors flex items-center gap-2"
            style={{ display: "flex" }}
          >
            Buy on TCGPlayer
            <span className="text-[9px] text-zinc-600 ml-auto">↗</span>
          </a>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="mt-1 pt-1">
            <button
              onClick={() => setCtxMenu(null)}
              className="w-full text-left px-3 py-2 text-xs text-zinc-600 hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Zoom modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={() => setZoomed(null)}
        >
          {zoomed.uri ? (
            <img
              src={scryfallImage(zoomed.uri, "png")}
              alt={zoomed.card.name}
              className="rounded-2xl shadow-2xl"
              style={{ maxHeight: "85vh", maxWidth: 360 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="rounded-2xl p-6 text-zinc-300 text-sm" style={{ background: "#18181f" }}>
              {zoomed.card.name}
            </div>
          )}
        </div>
      )}
    </>
  )
}
