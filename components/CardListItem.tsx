"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, Crown, CircleSlash, Trash2 } from "lucide-react"
import type { CardInDeck } from "@/types"
import { HoloCard } from "./HoloCard"
import { isCommanderEligible } from "@/lib/commander"
import { getDeckLimit } from "@/lib/rules"
import { scryfallImage } from "@/lib/scryfall"

interface Props {
  card: CardInDeck
  onRemove: (scryfallId: string) => void
  onQuantityChange: (scryfallId: string, delta: number) => void
  onToggleCommander: (scryfallId: string) => void
  commanderColorIdentity: string[]
  hasCommander: boolean
  alwaysShowActions?: boolean
}

function saltColor(s: number): string {
  if (s < 0.3) return "#6b7280"
  if (s < 1.0) return "#22c55e"
  if (s < 1.8) return "#eab308"
  if (s < 2.5) return "#f97316"
  return "#ef4444"
}

function saltLabel(s: number): string {
  if (s < 0.3) return "Harmless"
  if (s < 1.0) return "Low"
  if (s < 1.8) return "Moderate"
  if (s < 2.5) return "High"
  return "Very Salty"
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

export function CardListItem({ card, onRemove, onQuantityChange, onToggleCommander, commanderColorIdentity, hasCommander, alwaysShowActions }: Props) {
  const [imgError, setImgError] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)

  // Swipe-to-remove state
  const [swipeX, setSwipeX] = useState(0)
  const [swipeAnimating, setSwipeAnimating] = useState(false)
  const swipeXRef = useRef(0)
  const touchOrigin = useRef({ x: 0, y: 0, locked: false, isHorizontal: false })
  const didSwipeRef = useRef(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])
  const hideRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear all timers on unmount to prevent state updates on unmounted component
  useEffect(() => () => {
    if (hideRef.current) clearTimeout(hideRef.current)
    if (showRef.current) clearTimeout(showRef.current)
  }, [])

  const scheduleHide = useCallback(() => {
    if (showRef.current) { clearTimeout(showRef.current); showRef.current = null }
    hideRef.current = setTimeout(() => setShowPreview(false), 120)
  }, [])

  const cancelHide = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current)
  }, [])

  const scheduleShow = useCallback((x: number, y: number) => {
    cancelHide()
    setHoverPos({ x, y })
    if (showPreview) return
    showRef.current = setTimeout(() => setShowPreview(true), 80)
  }, [cancelHide, showPreview])

  // Swipe gesture handlers (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchOrigin.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: false, isHorizontal: false }
    didSwipeRef.current = false
    swipeXRef.current = swipeX
    setSwipeAnimating(false)
  }, [swipeX])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = touchOrigin.current.x - e.touches[0].clientX
    const dy = Math.abs(touchOrigin.current.y - e.touches[0].clientY)

    if (!touchOrigin.current.locked) {
      if (Math.abs(dx) < 4 && dy < 4) return
      touchOrigin.current.isHorizontal = Math.abs(dx) > dy
      touchOrigin.current.locked = true
    }

    if (touchOrigin.current.isHorizontal && dx > 0) {
      const clamped = Math.min(dx, 110)
      swipeXRef.current = clamped
      setSwipeX(clamped)
      if (clamped > 8) didSwipeRef.current = true
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    setSwipeAnimating(true)
    if (swipeXRef.current >= 70) {
      swipeXRef.current = 400
      setSwipeX(400)
      setTimeout(() => onRemove(card.scryfallId), 220)
    } else {
      swipeXRef.current = 0
      setSwipeX(0)
    }
  }, [onRemove, card.scryfallId])

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
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe-to-remove backdrop (mobile) */}
      {isMobile && swipeX > 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 pointer-events-none"
          style={{ width: Math.min(swipeX, 90) }}
          aria-hidden
        >
          {swipeX > 28 && <Trash2 className="w-4 h-4 text-white" />}
        </div>
      )}
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-colors relative ${accentBorder} ${activeBg} ${hoverBg}`}
      style={isMobile ? {
        transform: `translateX(-${Math.min(swipeX, 400)}px)`,
        transition: swipeAnimating ? "transform 0.22s cubic-bezier(0.2,0,0,1)" : "none",
        willChange: "transform",
      } : undefined}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      {/* Thumbnail */}
      <div
        className="relative flex-shrink-0 cursor-pointer"
        onClick={isMobile ? () => { if (!didSwipeRef.current) setShowPreview(true) } : undefined}
        onMouseEnter={isMobile ? undefined : (e) => scheduleShow(e.clientX, e.clientY)}
        onMouseMove={isMobile ? undefined : (e) => { if (showPreview) setHoverPos({ x: e.clientX, y: e.clientY }) }}
        onMouseLeave={isMobile ? undefined : scheduleHide}
      >
        {card.imageUri && !imgError ? (
          <img
            src={card.imageUri}
            alt={card.name}
            loading="lazy"
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
            card.tcgplayerUrl ? (
              <a href={card.tcgplayerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400/80 flex-shrink-0 hover:text-blue-300 underline decoration-dotted underline-offset-2">
                ${card.prices.usdFoil} ✦
              </a>
            ) : (
              <span className="text-[10px] text-blue-400/80 flex-shrink-0">${card.prices.usdFoil} ✦</span>
            )
          ) : card.prices?.usd ? (
            card.tcgplayerUrl ? (
              <a href={card.tcgplayerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-400/70 flex-shrink-0 hover:text-green-300 underline decoration-dotted underline-offset-2">
                ${card.prices.usd}
              </a>
            ) : (
              <span className="text-[10px] text-green-400/70 flex-shrink-0">${card.prices.usd}</span>
            )
          ) : card.prices?.usdFoil ? (
            card.tcgplayerUrl ? (
              <a href={card.tcgplayerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400/80 flex-shrink-0 hover:text-blue-300 underline decoration-dotted underline-offset-2">
                ${card.prices.usdFoil} ✦
              </a>
            ) : (
              <span className="text-[10px] text-blue-400/80 flex-shrink-0">${card.prices.usdFoil} ✦</span>
            )
          ) : null}
          {card.salt !== undefined && <SaltPill salt={card.salt} />}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex items-center transition-opacity flex-shrink-0 ${alwaysShowActions ? "opacity-100 gap-2" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 gap-0.5"}`}>
        {/* Quantity controls for basic lands and "any number" cards */}
        {isMultiCopy && (
          <>
            <button
              onClick={() => onQuantityChange(card.scryfallId, -1)}
              aria-label={`Remove one copy of ${card.name}`}
              className={`flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors font-bold leading-none ${alwaysShowActions ? "w-9 h-9 text-base" : "w-5 h-5 text-sm"}`}
            >
              −
            </button>
            <button
              onClick={() => onQuantityChange(card.scryfallId, +1)}
              aria-label={limit === Infinity ? `Add one more copy of ${card.name}` : `Add one more copy of ${card.name} (max ${limit})`}
              className={`flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors font-bold leading-none ${alwaysShowActions ? "w-9 h-9 text-base" : "w-5 h-5 text-sm"}`}
            >
              +
            </button>
          </>
        )}

        {isCommanderEligible(card) && (
          <button
            onClick={() => onToggleCommander(card.scryfallId)}
            aria-label={card.isCommander ? `Remove ${card.name} as commander` : `Set ${card.name} as commander`}
            className={`rounded-lg hover:bg-zinc-700/80 text-zinc-500 hover:text-amber-400 transition-colors ${alwaysShowActions ? "p-2.5" : "p-1.5"}`}
          >
            {card.isCommander ? <CircleSlash className={alwaysShowActions ? "w-4 h-4" : "w-3.5 h-3.5"} /> : <Crown className={alwaysShowActions ? "w-4 h-4" : "w-3.5 h-3.5"} />}
          </button>
        )}
        <button
          onClick={() => onRemove(card.scryfallId)}
          aria-label={`Remove ${card.name} from deck`}
          className={`rounded-lg hover:bg-red-500/15 text-zinc-500 hover:text-red-400 transition-colors ${alwaysShowActions ? "p-2.5" : "p-1.5"}`}
        >
          <X className={alwaysShowActions ? "w-4 h-4" : "w-3.5 h-3.5"} />
        </button>
      </div>

      {/* Card preview — portaled to <body> so a transformed/scrolling ancestor
          (the swipe row uses transform + willChange) can't clip the fixed overlay. */}
      {showPreview && card.imageUri && typeof document !== "undefined" && createPortal(
        <>
          {/* Mobile: full-screen backdrop to dismiss on tap */}
          {isMobile && (
            <div
              className="fixed inset-0 z-[99]"
              onClick={() => setShowPreview(false)}
            />
          )}
          <div
            className="fixed z-[100]"
            style={isMobile ? {
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "auto",
            } : {
              left: Math.min(hoverPos.x + 16, window.innerWidth - 230),
              top: Math.max(hoverPos.y - 100, 8),
              pointerEvents: "none",
            }}
            onClick={() => isMobile && setShowPreview(false)}
          >
            <div
              className="pointer-events-auto"
              style={{ width: isMobile ? "min(63vw, 43vh)" : 208 }}
              onMouseEnter={isMobile ? undefined : cancelHide}
              onMouseLeave={isMobile ? undefined : scheduleHide}
            >
              <HoloCard
                src={scryfallImage(card.imageUri, "large")}
                alt={card.name}
                imgStyle={{ borderRadius: "5%" }}
                imgClassName="w-full"
                foil={!!card.isFoil}
                mobileAnimate={isMobile && !!card.isFoil}
              />
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
    </div>
  )
}
