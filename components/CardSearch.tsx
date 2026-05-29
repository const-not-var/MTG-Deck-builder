"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, Loader2, Plus, ChevronLeft } from "lucide-react"
import type { ScryfallCard } from "@/types"

interface Props {
  onCardSelect: (card: ScryfallCard, isFoil: boolean) => void
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const handleSelectPrinting = (card: ScryfallCard, isFoil: boolean) => {
    onCardSelect(card, isFoil)
    setQuery("")
    setNames([])
    closeAll()
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
          className="w-full pl-9 pr-4 py-2.5 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
        )}
      </div>

      {open && (names.length > 0 || showingPrintings) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1.5 w-full rounded-xl shadow-2xl overflow-hidden"
          style={{ minWidth: "260px", background: "rgba(18,18,20,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}
        >
          {/* ── Name list ── */}
          {!showingPrintings && names.map((name) => (
            <button
              key={name}
              onClick={() => handleSelectName(name)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors text-left group"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 rotate-180 flex-shrink-0 transition-colors" />
              <span className="truncate">{name}</span>
            </button>
          ))}

          {/* ── Printing picker ── */}
          {showingPrintings && (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
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
                {printings.flatMap((card) => {
                  const img = getImage(card, "small")
                  const price = card.prices?.usd
                  const foilPrice = card.prices?.usd_foil
                  const eurPrice = card.prices?.eur
                  const eurFoilPrice = card.prices?.eur_foil
                  const hasBoth = !!(card.foil && card.nonfoil)

                  const setInfo = (
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      #{card.collector_number} · {card.lang?.toUpperCase() ?? "EN"}
                    </p>
                  )

                  const thumbnail = (
                    <div className="flex-shrink-0 w-8 h-11 rounded-sm overflow-hidden bg-zinc-800 border border-zinc-700">
                      {img && <img src={img} alt="" className="w-full h-full object-cover object-top" />}
                    </div>
                  )

                  if (hasBoth) {
                    return [
                      <button
                        key={`${card.id}-nonfoil`}
                        onClick={() => handleSelectPrinting(card, false)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/60 transition-colors text-left group"
                      >
                        {thumbnail}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">{card.set_name}</p>
                          {setInfo}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {price ? <p className="text-xs font-semibold text-green-400">${price}</p> : <p className="text-xs text-zinc-600">—</p>}
                        </div>
                        <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                      </button>,
                      <button
                        key={`${card.id}-foil`}
                        onClick={() => handleSelectPrinting(card, true)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/60 transition-colors text-left group"
                      >
                        {thumbnail}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">{card.set_name} <span className="text-blue-400/80">✦</span></p>
                          {setInfo}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {foilPrice ? <p className="text-xs font-semibold text-blue-400">${foilPrice} ✦</p> : <p className="text-xs text-zinc-600">—</p>}
                        </div>
                        <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                      </button>,
                    ]
                  }

                  const isFoilOnly = !!(card.foil && !card.nonfoil)
                  const fallbackEur = !price && !foilPrice ? (eurPrice || eurFoilPrice) : null
                  const fallbackEurIsFoil = !eurPrice && !!eurFoilPrice

                  return [
                    <button
                      key={card.id}
                      onClick={() => handleSelectPrinting(card, isFoilOnly)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/60 transition-colors text-left group"
                    >
                      {thumbnail}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">
                          {card.set_name}{isFoilOnly && <span className="text-blue-400/80"> ✦</span>}
                        </p>
                        {setInfo}
                      </div>
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
                      </div>
                      <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                    </button>,
                  ]
                })}
              </div>

              {!loadingPrintings && printings.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">No printings found.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
