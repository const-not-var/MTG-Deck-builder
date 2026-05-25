"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, Loader2, Plus, ChevronLeft } from "lucide-react"
import type { ScryfallCard } from "@/types"
import { ManaCost } from "./ManaSymbol"
import { HoloCard } from "./HoloCard"

interface Props {
  onCardSelect: (card: ScryfallCard) => void
  placeholder?: string
}

function getImage(card: ScryfallCard, size: "small" | "normal" = "small"): string {
  if (card.image_uris?.[size]) return card.image_uris[size]
  if (card.card_faces?.[0]?.image_uris?.[size]) return card.card_faces[0].image_uris[size]
  return ""
}

export function CardSearch({ onCardSelect, placeholder = "Search for a card…" }: Props) {
  const [query, setQuery] = useState("")
  const [names, setNames] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  // Printing picker state
  const [printings, setPrintings] = useState<ScryfallCard[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [loadingPrintings, setLoadingPrintings] = useState(false)

  // Hover preview
  const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const scheduleHide = () => {
    hideRef.current = setTimeout(() => setHoveredCard(null), 120)
  }
  const cancelHide = () => {
    if (hideRef.current) clearTimeout(hideRef.current)
  }

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setNames([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setNames(data.names ?? [])
      setOpen(true)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        closeAll()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const closeAll = () => {
    setOpen(false)
    setSelectedName(null)
    setPrintings([])
    setHoveredCard(null)
  }

  const handleSelectName = async (name: string) => {
    setSelectedName(name)
    setLoadingPrintings(true)
    setPrintings([])
    try {
      const res = await fetch(`/api/cards/printings?name=${encodeURIComponent(name)}`)
      const data = await res.json()
      setPrintings(data.printings ?? [])
    } finally {
      setLoadingPrintings(false)
    }
  }

  const handleSelectPrinting = (card: ScryfallCard) => {
    onCardSelect(card)
    setQuery("")
    setNames([])
    closeAll()
  }

  const handleHoverName = async (name: string, e: React.MouseEvent) => {
    setHoverPos({ x: e.clientX, y: e.clientY })
    if (hoveredCard?.name === name) return
    const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&full=1`)
    const data = await res.json()
    if (data.card) setHoveredCard(data.card)
  }

  const showingPrintings = selectedName !== null

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedName(null); setPrintings([]) }}
          onFocus={() => (names.length > 0 || showingPrintings) && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
        )}
      </div>

      {open && (names.length > 0 || showingPrintings) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
          style={{ minWidth: "260px" }}
        >
          {/* ── Name list ── */}
          {!showingPrintings && names.map((name) => (
            <button
              key={name}
              onMouseEnter={(e) => { cancelHide(); handleHoverName(name, e) }}
              onMouseLeave={scheduleHide}
              onClick={() => handleSelectName(name)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left group"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 rotate-180 flex-shrink-0 transition-colors" />
              <span className="truncate">{name}</span>
            </button>
          ))}

          {/* ── Printing picker ── */}
          {showingPrintings && (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                <button
                  onClick={() => { setSelectedName(null); setPrintings([]) }}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <span className="text-xs font-medium text-zinc-300 truncate">{selectedName}</span>
              </div>

              {loadingPrintings && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                </div>
              )}

              {/* Printings list */}
              <div className="max-h-72 overflow-y-auto">
                {printings.map((card) => {
                  const img = getImage(card, "small")
                  const price = card.prices?.usd
                  const foilPrice = card.prices?.usd_foil
                  const eurPrice = card.prices?.eur
                  const eurFoilPrice = card.prices?.eur_foil
                  // Fall back to EUR when no USD price exists
                  const fallbackEur = !price && !foilPrice ? (eurPrice || eurFoilPrice) : null
                  const fallbackEurIsFoil = !eurPrice && !!eurFoilPrice

                  return (
                    <button
                      key={card.id}
                      onClick={() => handleSelectPrinting(card)}
                      onMouseEnter={(e) => { cancelHide(); setHoverPos({ x: e.clientX, y: e.clientY }); setHoveredCard(card) }}
                      onMouseLeave={scheduleHide}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition-colors text-left group"
                    >
                      {/* Card thumbnail */}
                      <div className="flex-shrink-0 w-8 h-11 rounded-sm overflow-hidden bg-zinc-800 border border-zinc-700">
                        {img && <img src={img} alt="" className="w-full h-full object-cover object-top" />}
                      </div>

                      {/* Set info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{card.set_name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          #{card.collector_number} · {card.lang?.toUpperCase() ?? "EN"}
                          {card.foil && !card.nonfoil ? " · Foil only" : ""}
                        </p>
                      </div>

                      {/* Prices */}
                      <div className="flex-shrink-0 text-right">
                        {price ? (
                          <p className="text-xs font-semibold text-green-400">${price}</p>
                        ) : foilPrice ? (
                          <p className="text-xs font-semibold text-blue-400">${foilPrice} ✦</p>
                        ) : fallbackEur ? (
                          <p className="text-xs font-semibold text-zinc-400">€{fallbackEur}{fallbackEurIsFoil ? " ✦" : ""}</p>
                        ) : (
                          <p className="text-xs text-zinc-600">—</p>
                        )}
                        {price && foilPrice && (
                          <p className="text-[10px] text-blue-400/70">${foilPrice} ✦</p>
                        )}
                      </div>

                      <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                    </button>
                  )
                })}
              </div>

              {!loadingPrintings && printings.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">No printings found.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Card hover preview */}
      {hoveredCard && getImage(hoveredCard, "normal") && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 230),
            top: Math.max(hoverPos.y - 100, 8),
          }}
        >
          <div
            className="bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-700 w-52 pointer-events-auto"
            onMouseEnter={cancelHide}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <HoloCard
              src={getImage(hoveredCard, "normal")}
              alt={hoveredCard.name}
              imgStyle={{ borderRadius: "5%" }}
              imgClassName="w-full"
            />
            <div className="px-3 py-2">
              {hoveredCard.mana_cost && <ManaCost cost={hoveredCard.mana_cost} />}
              <p className="text-xs text-zinc-400 mt-1 leading-tight">{hoveredCard.type_line}</p>
              {hoveredCard.prices?.usd ? (
                <p className="text-xs text-green-400 mt-1">${hoveredCard.prices.usd}</p>
              ) : hoveredCard.prices?.usd_foil ? (
                <p className="text-xs text-blue-400 mt-1">${hoveredCard.prices.usd_foil} ✦</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
