"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Save, Trash2, ArrowLeft, Loader2, Check, Pencil } from "lucide-react"
import type { ScryfallCard, CardInDeck, Deck } from "@/types"
import { getCardImageUri, isBasicLand } from "@/lib/scryfall"
import { validateDeck } from "@/lib/validation"
import { CardSearch } from "./CardSearch"
import { CardListItem } from "./CardListItem"
import { DeckStats } from "./DeckStats"

const SECTIONS = [
  { key: "commander", label: "Commander", filter: (c: CardInDeck) => c.isCommander },
  { key: "creatures", label: "Creatures", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Creature") && !c.typeLine.includes("Land") },
  { key: "planeswalkers", label: "Planeswalkers", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Planeswalker") && !c.typeLine.includes("Creature") },
  { key: "instants", label: "Instants", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Instant") },
  { key: "sorceries", label: "Sorceries", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Sorcery") },
  { key: "artifacts", label: "Artifacts", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Artifact") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Enchantment") },
  { key: "enchantments", label: "Enchantments", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Enchantment") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Artifact") },
  { key: "lands", label: "Lands", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Land") },
]

interface Toast {
  id: number
  type: "error" | "success" | "warning"
  message: string
}

interface Props {
  deckId: string
}

export function DeckEditor({ deckId }: Props) {
  const router = useRouter()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  useEffect(() => {
    fetch(`/api/decks/${deckId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.deck) {
          setDeck(data.deck)
          setNameInput(data.deck.name)
        }
      })
      .finally(() => setLoading(false))
  }, [deckId])

  const handleCardSelect = useCallback((card: ScryfallCard) => {
    if (!deck) return

    if (card.legalities?.commander === "banned") {
      addToast("error", `${card.name} is banned in Commander.`)
      return
    }

    // Duplicate check (skip basic lands)
    if (!isBasicLand(card.type_line, card.name)) {
      const exists = deck.cards.find((c) => c.scryfallId === card.id)
      if (exists) {
        addToast("warning", `${card.name} is already in your deck.`)
        return
      }
    }

    // Color identity check
    const commander = deck.cards.find((c) => c.isCommander)
    if (commander && !isBasicLand(card.type_line, card.name)) {
      const outside = card.color_identity.filter((c) => !commander.colorIdentity.includes(c))
      if (outside.length > 0) {
        addToast("error", `${card.name} is outside your commander's color identity.`)
        return
      }
    }

    const newCard: CardInDeck = {
      scryfallId: card.id,
      name: card.name,
      quantity: 1,
      cmc: card.cmc,
      typeLine: card.type_line,
      colorIdentity: card.color_identity,
      manaCost: card.mana_cost ?? "",
      prices: { usd: card.prices?.usd ?? undefined, usdFoil: card.prices?.usd_foil ?? undefined },
      imageUri: getCardImageUri(card),
      isCommander: false,
    }

    setDeck((d) => d ? { ...d, cards: [...d.cards, newCard] } : d)
    setSaved(false)
    addToast("success", `${card.name} added.`)
  }, [deck, addToast])

  const handleRemove = useCallback((scryfallId: string) => {
    setDeck((d) => d ? { ...d, cards: d.cards.filter((c) => c.scryfallId !== scryfallId) } : d)
    setSaved(false)
  }, [])

  const handleToggleCommander = useCallback((scryfallId: string) => {
    setDeck((d) => {
      if (!d) return d
      const target = d.cards.find((c) => c.scryfallId === scryfallId)
      if (!target) return d

      // Check if card can be commander (legendary creature, legendary planeswalker, or explicitly allowed)
      const isLegendaryCreature = target.typeLine.includes("Legendary") && target.typeLine.includes("Creature")
      const isLegendaryPlaneswalker = target.typeLine.includes("Legendary") && target.typeLine.includes("Planeswalker")
      const hasSpecialText = false // Could check oracle text for "can be your commander"

      if (!target.isCommander && !isLegendaryCreature && !isLegendaryPlaneswalker && !hasSpecialText) {
        addToast("error", `${target.name} must be a Legendary Creature or Planeswalker to be your commander.`)
        return d
      }

      return {
        ...d,
        cards: d.cards.map((c) => ({
          ...c,
          isCommander: c.scryfallId === scryfallId ? !c.isCommander : false,
        })),
      }
    })
    setSaved(false)
  }, [addToast])

  const handleSave = async () => {
    if (!deck) return
    setSaving(true)
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deck.name, description: deck.description, cards: deck.cards }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved(true)
      addToast("success", "Deck saved!")
    } catch {
      addToast("error", "Failed to save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${deck?.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/decks/${deckId}`, { method: "DELETE" })
      router.push("/decks")
    } catch {
      addToast("error", "Failed to delete. Try again.")
      setDeleting(false)
    }
  }

  const handleNameSave = () => {
    if (!nameInput.trim()) return
    setDeck((d) => d ? { ...d, name: nameInput.trim() } : d)
    setEditingName(false)
    setSaved(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-zinc-400">Deck not found.</p>
        <button onClick={() => router.push("/decks")} className="text-sm text-amber-400 hover:underline">
          Back to My Decks
        </button>
      </div>
    )
  }

  const validation = validateDeck(deck.cards)
  const commander = deck.cards.find((c) => c.isCommander)
  const commanderColorIdentity = commander?.colorIdentity ?? []

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Editor header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <button
          onClick={() => router.push("/decks")}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Decks</span>
        </button>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {editingName ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleNameSave() }}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                className="flex-1 min-w-0 bg-zinc-800 border border-amber-500 rounded-md px-2 py-1 text-sm text-zinc-100 focus:outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-2 group min-w-0"
            >
              <h1 className="text-base font-semibold text-zinc-100 truncate">{deck.name}</h1>
              <Pencil className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            validation.cardCount === 100 ? "bg-green-950 text-green-400" : "bg-zinc-800 text-zinc-400"
          }`}>
            {validation.cardCount}/100
          </span>

          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: card search */}
        <div className="w-72 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950/50">
          <div className="p-3 border-b border-zinc-800">
            <CardSearch onCardSelect={handleCardSelect} />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs text-zinc-600 text-center mt-8 leading-relaxed">
              Search above to find cards.<br />
              Hover over a suggestion to preview it.
            </p>
          </div>
        </div>

        {/* Center: card list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4 max-w-2xl">
            {SECTIONS.map(({ key, label, filter }) => {
              const sectionCards = deck.cards.filter(filter)
              if (sectionCards.length === 0) return null
              const sectionTotal = sectionCards.reduce((s, c) => s + c.quantity, 0)
              const sectionPrice = sectionCards.reduce((s, c) => {
                const p = parseFloat(c.prices?.usd ?? "0")
                return s + (isNaN(p) ? 0 : p * c.quantity)
              }, 0)

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5 px-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      {label} ({sectionTotal})
                    </span>
                    <span className="text-xs text-zinc-600">${sectionPrice.toFixed(2)}</span>
                  </div>
                  <div className="space-y-0.5">
                    {sectionCards.map((card) => (
                      <CardListItem
                        key={card.scryfallId}
                        card={card}
                        onRemove={handleRemove}
                        onToggleCommander={handleToggleCommander}
                        commanderColorIdentity={commanderColorIdentity}
                        hasCommander={!!commander}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {deck.cards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-zinc-500 text-sm">Your deck is empty.</p>
                <p className="text-zinc-600 text-xs mt-1">Search for cards on the left to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: stats */}
        <div className="w-64 flex-shrink-0 border-l border-zinc-800 overflow-y-auto bg-zinc-950/50">
          <div className="p-4">
            <DeckStats cards={deck.cards} validation={validation} />
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all ${
              t.type === "error" ? "bg-red-950 border border-red-800 text-red-300" :
              t.type === "warning" ? "bg-yellow-950 border border-yellow-800 text-yellow-300" :
              "bg-green-950 border border-green-800 text-green-300"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

