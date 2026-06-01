"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Swords, Plus, ArrowRight, Loader2, Users } from "lucide-react"
import { Navbar } from "@/components/Navbar"
import type { Deck } from "@/types"

interface Props {
  userId: string
  userName: string
}

export function LobbyClient({ userName }: Props) {
  const router = useRouter()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loadingDecks, setLoadingDecks] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [selectedDeck, setSelectedDeck] = useState("")
  const [joinDeck, setJoinDeck] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/decks")
      .then(r => r.json())
      .then(d => { setDecks(d.decks ?? []); setLoadingDecks(false) })
      .catch(() => setLoadingDecks(false))
  }, [])

  const handleCreate = async () => {
    if (!selectedDeck) { setError("Select a deck first"); return }
    setCreating(true); setError("")
    try {
      const res = await fetch("/api/game", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Auto-join as host
      const joinRes = await fetch(`/api/game/${data.game.code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: selectedDeck }),
      })
      if (!joinRes.ok) throw new Error("Failed to join own game")
      router.push(`/game/${data.game.code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game")
      setCreating(false)
    }
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setError("Enter a 6-character game code"); return }
    if (!joinDeck) { setError("Select a deck first"); return }
    setJoining(true); setError("")
    try {
      const res = await fetch(`/api/game/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: joinDeck }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/game/${code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join game")
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06071c" }}>
      <Navbar userName={userName} />
      <div className="h-14 flex-shrink-0" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.08))", border: "1px solid rgba(245,158,11,0.3)" }}>
              <Swords className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">Commander Vault <span style={{ color: "#f59e0b" }}>Play</span></h1>
            <p className="text-sm text-zinc-500 mt-2">Real-time multiplayer Commander — 2 to 4 players</p>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Create Game */}
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <h2 className="font-bold text-zinc-100 text-sm">Create Game</h2>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Your Deck</label>
                {loadingDecks ? (
                  <div className="h-9 rounded-lg bg-zinc-800/60 animate-pulse" />
                ) : (
                  <select
                    value={selectedDeck}
                    onChange={e => setSelectedDeck(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Select a deck…</option>
                    {decks.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                )}
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !selectedDeck}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-40 transition-colors"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Creating…" : "Create & Share Code"}
              </button>
            </div>

            {/* Join Game */}
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h2 className="font-bold text-zinc-100 text-sm">Join Game</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Game Code</label>
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="XXXXXX"
                    className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-sm text-zinc-100 font-mono tracking-widest focus:outline-none focus:border-blue-500/50 placeholder:tracking-normal"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Your Deck</label>
                  {loadingDecks ? (
                    <div className="h-9 rounded-lg bg-zinc-800/60 animate-pulse" />
                  ) : (
                    <select
                      value={joinDeck}
                      onChange={e => setJoinDeck(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">Select a deck…</option>
                      {decks.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <button
                onClick={handleJoin}
                disabled={joining || !joinCode.trim() || !joinDeck}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-colors"
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {joining ? "Joining…" : "Join Game"}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-700">
            Desktop only · 2–4 players · Manual rules enforcement
          </p>
        </div>
      </div>
    </div>
  )
}
