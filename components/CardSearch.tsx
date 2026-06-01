"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
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

export function CardSearch({ onCardSelect, placeholder = "Card name or collector number…" }: Props) {
  const [query, setQuery] = useState("")
  const [names, setNames] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Printing picker state
  const [printings, setPrintings] = useState<ScryfallCard[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [loadingPrintings, setLoadingPrintings] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const printingsAbortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)

  const showingPrintings = selectedName !== null

  // Flat list of printing options used for keyboard navigation and rendering
  const flatPrintings = useMemo(() => printings.flatMap(card => {
    if (card.foil && card.nonfoil) return [{ card, isFoil: false }, { card, isFoil: true }]
    return [{ card, isFoil: !!(card.foil && !card.nonfoil) }]
  }), [printings])

  // Reset active index whenever the option list changes
  useEffect(() => { setActiveIndex(-1) }, [names, flatPrintings])

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listboxRef.current) return
    const el = listboxRef.current.querySelector(`[data-cs-idx="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const search = useCallback(async (q: string) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    if (q.length < 2) {
      setNames([])
      setPrintings([])
      setSelectedName(null)
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`, { signal: abortRef.current.signal })
      const data = await res.json()
      if (data.type === "collector") {
        setNames([])
        setSelectedName(`#${q.trim()}`)
        setPrintings(data.cards ?? [])
      } else {
        setNames(data.names ?? [])
        setSelectedName(null)
        setPrintings([])
      }
      setOpen(true)
    } catch (e) {
      if ((e as Error).name === "AbortError") return
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 120)
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
    setActiveIndex(-1)
  }

  const handleSelectName = async (name: string) => {
    printingsAbortRef.current?.abort()
    printingsAbortRef.current = new AbortController()
    setSelectedName(name)
    setLoadingPrintings(true)
    setPrintings([])
    setActiveIndex(-1)
    try {
      const res = await fetch(`/api/cards/printings?name=${encodeURIComponent(name)}`, { signal: printingsAbortRef.current.signal })
      const data = await res.json()
      setPrintings(data.printings ?? [])
    } catch (e) {
      if ((e as Error).name !== "AbortError") setPrintings([])
    } finally {
      setLoadingPrintings(false)
    }
  }

  const handleSelectPrinting = (card: ScryfallCard, isFoil: boolean) => {
    onCardSelect(card, isFoil)
    setQuery("")
    setNames([])
    closeAll()
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return

    if (!showingPrintings) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, names.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, -1))
      } else if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault()
          handleSelectName(names[activeIndex])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        closeAll()
      }
    } else {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, flatPrintings.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, -1))
      } else if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault()
          const { card, isFoil } = flatPrintings[activeIndex]
          handleSelectPrinting(card, isFoil)
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        setSelectedName(null)
        setPrintings([])
        setActiveIndex(-1)
      }
    }
  }

  const isDropdownOpen = open && (names.length > 0 || showingPrintings)

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isDropdownOpen}
          aria-controls="card-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `cs-opt-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedName(null); setPrintings([]) }}
          onFocus={() => (names.length > 0 || showingPrintings) && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2.5 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" aria-hidden />
        )}
      </div>

      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1.5 w-full rounded-xl shadow-2xl overflow-hidden"
          style={{ minWidth: "260px", background: "rgba(18,18,20,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}
        >
          {/* ── Name list ── */}
          {!showingPrintings && (
            <div
              ref={listboxRef}
              id="card-search-listbox"
              role="listbox"
              aria-label="Card suggestions"
            >
              {names.map((name, i) => (
                <button
                  key={name}
                  id={`cs-opt-${i}`}
                  role="option"
                  aria-selected={activeIndex === i}
                  data-cs-idx={i}
                  onClick={() => handleSelectName(name)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 transition-colors text-left group ${activeIndex === i ? "bg-zinc-700/70" : "hover:bg-zinc-800/60"}`}
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 rotate-180 flex-shrink-0 transition-colors" aria-hidden />
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Printing picker ── */}
          {showingPrintings && (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
                <button
                  onClick={() => { setSelectedName(null); setPrintings([]); setActiveIndex(-1) }}
                  aria-label="Back to search results"
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                  Back
                </button>
                <span className="text-xs font-medium text-zinc-300 truncate">
                  {selectedName?.startsWith("#") ? `Results for "${selectedName.slice(1)}"` : selectedName}
                </span>
              </div>

              {loadingPrintings && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" aria-hidden />
                  <span className="sr-only">Loading printings…</span>
                </div>
              )}

              {/* Printings list */}
              <div
                ref={listboxRef}
                id="card-search-listbox"
                role="listbox"
                aria-label="Card printings"
                className="max-h-[55vh] overflow-y-auto"
                style={{ overscrollBehavior: "contain" }}
              >
                {flatPrintings.map(({ card, isFoil }, i) => {
                  const img = getImage(card, "small")
                  const price = card.prices?.usd
                  const foilPrice = card.prices?.usd_foil
                  const eurPrice = card.prices?.eur
                  const eurFoilPrice = card.prices?.eur_foil
                  const fallbackEur = !price && !foilPrice ? (eurPrice || eurFoilPrice) : null
                  const fallbackEurIsFoil = !eurPrice && !!eurFoilPrice
                  const displayPrice = isFoil ? foilPrice : price
                  const label = `${card.set_name}${isFoil ? " foil" : ""}, #${card.collector_number}`

                  return (
                    <button
                      key={`${card.id}-${isFoil ? "foil" : "nonfoil"}`}
                      id={`cs-opt-${i}`}
                      role="option"
                      aria-selected={activeIndex === i}
                      aria-label={label}
                      data-cs-idx={i}
                      onClick={() => handleSelectPrinting(card, isFoil)}
                      className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left group ${activeIndex === i ? "bg-zinc-700/70" : "hover:bg-zinc-800/60"}`}
                    >
                      <div className="flex-shrink-0 w-8 h-11 rounded-sm overflow-hidden bg-zinc-800 border border-zinc-700" aria-hidden>
                        {img && <img src={img} alt="" loading="lazy" className="w-full h-full object-cover object-top" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">
                          {card.set_name}{isFoil && <span className="text-blue-400/80"> ✦</span>}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5" aria-hidden>
                          #{card.collector_number} · {card.lang?.toUpperCase() ?? "EN"}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right" aria-hidden>
                        {displayPrice ? (
                          <p className={`text-xs font-semibold ${isFoil ? "text-blue-400" : "text-green-400"}`}>
                            ${displayPrice}{isFoil ? " ✦" : ""}
                          </p>
                        ) : fallbackEur ? (
                          <p className="text-xs font-semibold text-zinc-400">€{fallbackEur}{fallbackEurIsFoil ? " ✦" : ""}</p>
                        ) : (
                          <p className="text-xs text-zinc-600">—</p>
                        )}
                      </div>
                      <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" aria-hidden />
                    </button>
                  )
                })}
              </div>

              {!loadingPrintings && flatPrintings.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">No printings found.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
