"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, Loader2, Plus } from "lucide-react"
import type { ScryfallCard } from "@/types"
import { ManaCost } from "./ManaSymbol"

interface Props {
  onCardSelect: (card: ScryfallCard) => void
  placeholder?: string
}

export function CardSearch({ onCardSelect, placeholder = "Search for a card…" }: Props) {
  const [query, setQuery] = useState("")
  const [names, setNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCard, setLoadingCard] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setNames([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setNames(data.names ?? [])
      setOpen(true)
    } finally {
      setLoading(false)
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
        setOpen(false)
        setHoveredCard(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSelect = async (name: string) => {
    setLoadingCard(name)
    setOpen(false)
    setQuery("")
    setNames([])
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&full=1`)
      const data = await res.json()
      if (data.card) onCardSelect(data.card)
    } finally {
      setLoadingCard(null)
    }
  }

  const handleHover = async (name: string, e: React.MouseEvent) => {
    setHoverPos({ x: e.clientX, y: e.clientY })
    if (hoveredCard?.name === name) return
    const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&full=1`)
    const data = await res.json()
    if (data.card) setHoveredCard(data.card)
  }

  const getImageUri = (card: ScryfallCard) => {
    if (card.image_uris?.normal) return card.image_uris.normal
    if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
    return ""
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => names.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
        )}
      </div>

      {loadingCard && (
        <div className="mt-1.5 text-xs text-zinc-500 flex items-center gap-1.5 px-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Fetching {loadingCard}…
        </div>
      )}

      {open && names.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
        >
          {names.map((name) => (
            <button
              key={name}
              onMouseEnter={(e) => handleHover(name, e)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => handleSelect(name)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left group"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Card hover preview */}
      {hoveredCard && getImageUri(hoveredCard) && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 230),
            top: Math.max(hoverPos.y - 100, 8),
          }}
        >
          <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-700 w-52">
            <img src={getImageUri(hoveredCard)} alt={hoveredCard.name} className="w-full" />
            <div className="px-3 py-2">
              {hoveredCard.mana_cost && <ManaCost cost={hoveredCard.mana_cost} />}
              <p className="text-xs text-zinc-400 mt-1 leading-tight line-clamp-3">{hoveredCard.type_line}</p>
              {hoveredCard.prices?.usd && (
                <p className="text-xs text-green-400 mt-1">${hoveredCard.prices.usd}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
