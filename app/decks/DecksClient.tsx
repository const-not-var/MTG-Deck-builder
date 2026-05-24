"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Swords, X } from "lucide-react"
import type { Deck } from "@/types"
import { Navbar } from "@/components/Navbar"
import { DeckCard } from "@/components/DeckCard"

interface Props {
  userName?: string | null
}

export function DecksClient({ userName }: Props) {
  const router = useRouter()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => r.json())
      .then((data) => setDecks(data.decks ?? []))
      .finally(() => setLoading(false))
  }, [])

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

    if (!res.ok) {
      setCreateError(data.error ?? "Failed to create deck.")
      return
    }
    router.push(`/decks/${data.deck._id}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userName={userName} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">My Decks</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {loading ? "Loading…" : `${decks.length} deck${decks.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => { setShowNewModal(true); setNewDeckName(""); setCreateError("") }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Deck
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
              <Swords className="w-7 h-7 text-zinc-600" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-300 mb-2">No decks yet</h2>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs">
              Build your first Commander deck and start tracking prices with Scryfall data.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first deck
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {decks.map((deck) => (
              <DeckCard key={deck._id} deck={deck} />
            ))}
          </div>
        )}
      </main>

      {/* New deck modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-100">New Deck</h2>
              <button onClick={() => setShowNewModal(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Deck Name</label>
                <input
                  autoFocus
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="My Atraxa Deck"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                />
                {createError && <p className="text-xs text-red-400 mt-1">{createError}</p>}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDeckName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
