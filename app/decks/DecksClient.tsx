"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Loader2, Swords, X, Search, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"
import type { Deck } from "@/types"
import { Navbar } from "@/components/Navbar"
import { DeckCard } from "@/components/DeckCard"

interface Props {
  userName?: string | null
}

const COLOR_OPTIONS = [
  { key: "W", label: "White",  bg: "#f9fafb", shadow: "rgba(249,250,251,0.5)" },
  { key: "U", label: "Blue",   bg: "#60a5fa", shadow: "rgba(96,165,250,0.5)"  },
  { key: "B", label: "Black",  bg: "#c084fc", shadow: "rgba(192,132,252,0.5)" },
  { key: "R", label: "Red",    bg: "#f87171", shadow: "rgba(248,113,113,0.5)" },
  { key: "G", label: "Green",  bg: "#4ade80", shadow: "rgba(74,222,128,0.5)"  },
]

type SortKey = "recent" | "name" | "price"

function getDeckPrice(deck: Deck): number {
  return deck.cards.reduce((s, c) => {
    const raw = c.isFoil ? c.prices?.usdFoil : c.prices?.usd
    const p = parseFloat(raw ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0)
}

export function DecksClient({ userName }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(searchParams.get("new") === "1")
  const [newDeckName, setNewDeckName] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  // Search / sort / filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("recent")
  const [filterColors, setFilterColors] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setDecks(data.decks ?? []))
      .catch(() => toast.error("Couldn't load your decks. Please refresh."))
      .finally(() => setLoading(false))
  }, [])

  // Filtered + sorted deck list
  const filteredDecks = useMemo(() => {
    let result = [...decks]
    const q = searchQuery.trim().toLowerCase()

    // Search by deck name or commander name
    if (q) {
      result = result.filter((d) => {
        const commander = d.cards.find((c) => c.isCommander)
        return (
          d.name.toLowerCase().includes(q) ||
          (commander?.name?.toLowerCase().includes(q) ?? false)
        )
      })
    }

    // Color filter — deck must include ALL selected colors in commander identity
    if (filterColors.length > 0) {
      result = result.filter((d) => {
        const commander = d.cards.find((c) => c.isCommander)
        const identity = commander?.colorIdentity ?? []
        return filterColors.every((col) => identity.includes(col))
      })
    }

    // Sort
    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "price") {
      result.sort((a, b) => getDeckPrice(b) - getDeckPrice(a))
    } else {
      // recent — sort by updatedAt descending
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return result
  }, [decks, searchQuery, sortBy, filterColors])

  const isFiltering = searchQuery.trim() || filterColors.length > 0

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDeckName.trim()) return
    setCreating(true)
    setCreateError("")
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDeckName.trim() }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateError(data.error ?? "Failed to create deck."); return }
    router.push(`/decks/${data.deck._id}`)
  }

  const handleDuplicate = async (deck: Deck) => {
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${deck.name} (Copy)`, cards: deck.cards }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDecks((prev) => [...prev, data.deck])
      toast.success("Deck duplicated", {
        action: { label: "Open", onClick: () => router.push(`/decks/${data.deck._id}`) },
      })
    } catch {
      toast.error("Failed to duplicate deck.")
    }
  }

  const handleDelete = async (deck: Deck) => {
    try {
      await fetch(`/api/decks/${deck._id}`, { method: "DELETE" })
      setDecks((prev) => prev.filter((d) => d._id !== deck._id))
      toast.success(`"${deck.name}" deleted.`)
    } catch {
      toast.error("Failed to delete deck.")
    }
  }

  const toggleColor = (color: string) => {
    setFilterColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    )
  }

  const cycleSortBy: SortKey[] = ["recent", "name", "price"]
  const sortLabels: Record<SortKey, string> = { recent: "Recent", name: "A → Z", price: "Price" }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 90% 70% at 8% 65%, rgba(109,40,217,0.38) 0%, transparent 60%)",
              "radial-gradient(ellipse 65% 50% at 92% 18%, rgba(245,158,11,0.24) 0%, transparent 55%)",
              "radial-gradient(ellipse 55% 45% at 55% 98%, rgba(6,182,212,0.18) 0%, transparent 55%)",
              "#06071e",
            ].join(", "),
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar userName={userName} />
        <div className="h-14 flex-shrink-0" />

        {/* Page header */}
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-4 sm:pb-6 animate-fade-in">
          <p className="text-xs font-bold text-amber-500/70 uppercase tracking-[0.18em] mb-2.5">
            Commander Vault
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none">
            {userName ? `${userName}'s Decks` : "My Decks"}
          </h1>
          <p className="text-sm text-zinc-400/80 mt-3">
            {loading
              ? "Loading your collection…"
              : isFiltering
              ? `${filteredDecks.length} of ${decks.length} deck${decks.length !== 1 ? "s" : ""}`
              : `${decks.length} deck${decks.length !== 1 ? "s" : ""} in your collection`}
          </p>
        </div>

        {/* Search / sort / filter bar */}
        {!loading && decks.length > 0 && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-5 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" aria-hidden />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search decks…"
                  aria-label="Search decks"
                  className="w-full pl-8 pr-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <button
                onClick={() => setSortBy((s) => {
                  const idx = cycleSortBy.indexOf(s)
                  return cycleSortBy[(idx + 1) % cycleSortBy.length]
                })}
                aria-label={`Sort by: ${sortLabels[sortBy]}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700/50 bg-zinc-800/60 hover:bg-zinc-800"
              >
                <ArrowUpDown className="w-3 h-3" aria-hidden />
                {sortLabels[sortBy]}
              </button>

              {/* Color filter pips */}
              <div className="flex items-center gap-0.5 sm:gap-1.5" role="group" aria-label="Filter by color">
                {COLOR_OPTIONS.map(({ key, label, bg, shadow }) => {
                  const active = filterColors.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleColor(key)}
                      aria-label={`${active ? "Remove" : "Add"} ${label} filter`}
                      aria-pressed={active}
                      className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto flex-shrink-0"
                    >
                      <div
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all duration-200"
                        style={{
                          backgroundColor: bg,
                          boxShadow: active ? `0 0 10px ${shadow}, 0 0 0 2px rgba(255,255,255,0.3)` : "none",
                          opacity: active ? 1 : 0.35,
                          transform: active ? "scale(1.15)" : "scale(1)",
                          border: "1px solid rgba(0,0,0,0.3)",
                        }}
                      />
                    </button>
                  )
                })}
                {filterColors.length > 0 && (
                  <button
                    onClick={() => setFilterColors([])}
                    aria-label="Clear color filters"
                    className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pb-28 sm:pb-14">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton rounded-2xl" style={{ aspectRatio: "3/4", animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          ) : decks.length === 0 ? (
            /* Empty state — no decks at all */
            <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-up">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-6 shadow-xl">
                <Swords className="w-9 h-9 text-zinc-600" />
              </div>
              <h2 className="text-xl font-bold text-zinc-200 mb-2">No decks yet</h2>
              <p className="text-sm text-zinc-500 mb-8 max-w-xs leading-relaxed">
                Build your first Commander deck and start tracking prices with live Scryfall data.
              </p>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 shadow-lg shadow-amber-500/25"
              >
                <Plus className="w-4 h-4" />
                Create your first deck
              </button>
            </div>
          ) : filteredDecks.length === 0 ? (
            /* Empty state — filters active but no matches */
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-up">
              <p className="text-zinc-400 font-semibold mb-1">No decks match your filters</p>
              <button
                onClick={() => { setSearchQuery(""); setFilterColors([]) }}
                className="text-sm text-amber-400 hover:text-amber-300 mt-2 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {/* New deck card — hidden on mobile (FAB handles it there) */}
              <div className="hidden sm:block animate-fade-up" style={{ animationDelay: "0ms" }}>
                <button
                  onClick={() => setShowNewModal(true)}
                  aria-label="Create new deck"
                  className="group relative block w-full outline-none"
                  style={{ aspectRatio: "3/4" }}
                >
                  <div
                    className="relative rounded-2xl overflow-hidden w-full h-full flex flex-col items-center justify-center transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl"
                    style={{
                      background: "rgba(11,12,30,0.7)",
                      border: "1.5px dashed rgba(245,158,11,0.28)",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(245,158,11,0.28)",
                      }}
                    >
                      <Plus className="w-6 h-6 text-amber-400" />
                    </div>
                    <span className="text-xs font-bold text-amber-400/80 tracking-wide">New Deck</span>
                  </div>
                </button>
              </div>

              {filteredDecks.map((deck, i) => (
                <div
                  key={deck._id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${(i + 1) * 55}ms` }}
                >
                  <DeckCard
                    deck={deck}
                    onDuplicate={() => handleDuplicate(deck)}
                    onDelete={() => handleDelete(deck)}
                  />
                </div>
              ))}
            </div>
          )}
        </main>

        <p className="md:hidden text-center text-[10px] text-zinc-700 leading-relaxed px-4 py-4">
          commandervault.net is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
        </p>
      </div>

      {/* Mobile FAB — New Deck */}
      <button
        className="sm:hidden fixed z-40 flex items-center justify-center w-14 h-14 rounded-full bg-amber-500 shadow-2xl active:scale-95 transition-transform"
        style={{
          bottom: "max(24px, calc(env(safe-area-inset-bottom) + 16px))",
          right: "20px",
          boxShadow: "0 8px 32px rgba(245,158,11,0.45), 0 2px 8px rgba(0,0,0,0.4)",
        }}
        onClick={() => setShowNewModal(true)}
        aria-label="Create new deck"
      >
        <Plus className="w-6 h-6 text-zinc-950" />
      </button>

      {/* New deck modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false) }}
        >
          <div
            className="w-full max-w-sm animate-scale-in"
            style={{
              background: "rgba(12,12,26,0.97)",
              border: "1px solid rgba(245,158,11,0.15)",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-zinc-100">Create New Deck</h2>
              <button
                onClick={() => setShowNewModal(false)}
                aria-label="Close"
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="new-deck-name" className="block text-xs font-bold text-zinc-400 mb-2 tracking-widest uppercase">
                  Deck Name
                </label>
                <input
                  id="new-deck-name"
                  autoFocus
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="My Atraxa Deck"
                  className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15"
                />
                {createError && <p className="text-xs text-red-400 mt-1.5" role="alert">{createError}</p>}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm text-zinc-400 border border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDeckName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25 transition-colors"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {creating ? "Creating…" : "Create & Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
