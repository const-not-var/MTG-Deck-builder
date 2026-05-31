"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Loader2, Swords, X, Library } from "lucide-react"
import type { Deck } from "@/types"
import { Navbar } from "@/components/Navbar"
import { DeckCard } from "@/components/DeckCard"

interface Props {
  userName?: string | null
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
    if (!res.ok) { setCreateError(data.error ?? "Failed to create deck."); return }
    router.push(`/decks/${data.deck._id}`)
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Vivid gradient background */}
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
        {/* Dot grid texture */}
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

        {/* Page header */}
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-8 animate-fade-in">
          <div>
            <p className="text-xs font-bold text-amber-500/70 uppercase tracking-[0.18em] mb-2.5">
              Commander Vault
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none">
              {userName ? `${userName}'s Decks` : "My Decks"}
            </h1>
            <p className="text-sm text-zinc-400/80 mt-3">
              {loading
                ? "Loading your collection…"
                : `${decks.length} deck${decks.length !== 1 ? "s" : ""} in your collection`}
            </p>
          </div>
        </div>

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pb-14">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton rounded-2xl animate-fade-in" style={{ aspectRatio: "3/4", animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          ) : decks.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {decks.map((deck, i) => (
                <div
                  key={deck._id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <DeckCard deck={deck} />
                </div>
              ))}
            </div>
          )}
        </main>


      </div>

      {/* New deck modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false) }}
        >
          <div
            className="w-full max-w-sm animate-fade-up"
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
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 tracking-widest uppercase">
                  Deck Name
                </label>
                <input
                  autoFocus
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="My Atraxa Deck"
                  className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15"
                />
                {createError && <p className="text-xs text-red-400 mt-1.5">{createError}</p>}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm text-zinc-400 border border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDeckName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25"
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
