"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Save, Trash2, ArrowLeft, Loader2, Check, Pencil, Swords, RefreshCw } from "lucide-react"
import type { ScryfallCard, CardInDeck, Deck } from "@/types"
import { getCardImageUri, isBasicLand } from "@/lib/scryfall"
import { validateDeck } from "@/lib/validation"
import { isCommanderEligible, canCoCommand, getCombinedColorIdentity, getPartnerMode, partnerModeLabel } from "@/lib/commander"
import { getDeckLimit } from "@/lib/rules"
import { CardSearch } from "./CardSearch"
import { CardListItem } from "./CardListItem"
import { DeckStats } from "./DeckStats"

const SECTIONS = [
  { key: "commander",    label: "Commander",    filter: (c: CardInDeck) => c.isCommander },
  { key: "creatures",    label: "Creatures",    filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Creature") && !c.typeLine.includes("Land") },
  { key: "planeswalkers",label: "Planeswalkers",filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Planeswalker") && !c.typeLine.includes("Creature") },
  { key: "battles",      label: "Battles",      filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Battle") && !c.typeLine.includes("Creature") },
  { key: "instants",     label: "Instants",     filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Instant") },
  { key: "sorceries",    label: "Sorceries",    filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Sorcery") },
  // Exclude Creatures, Enchantments, and Lands so artifact versions of those go to their own section
  { key: "artifacts",    label: "Artifacts",    filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Artifact") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Enchantment") && !c.typeLine.includes("Land") },
  { key: "enchantments", label: "Enchantments", filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Enchantment") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Artifact") },
  { key: "lands",        label: "Lands",        filter: (c: CardInDeck) => !c.isCommander && c.typeLine.includes("Land") },
  // Catch-all for any card type not covered above (e.g. future types)
  {
    key: "other", label: "Other",
    filter: (c: CardInDeck) =>
      !c.isCommander &&
      !c.typeLine.includes("Creature") &&
      !c.typeLine.includes("Planeswalker") &&
      !c.typeLine.includes("Battle") &&
      !c.typeLine.includes("Instant") &&
      !c.typeLine.includes("Sorcery") &&
      !c.typeLine.includes("Artifact") &&
      !c.typeLine.includes("Enchantment") &&
      !c.typeLine.includes("Land"),
  },
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
  const [refreshing, setRefreshing] = useState(false)
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
        if (!data.deck) return
        setDeck(data.deck)
        setNameInput(data.deck.name)

        // Backfill oracleText for cards saved before that field existed.
        // Without oracleText the rules engine can't detect partner abilities,
        // copy limits, etc., so we silently refresh from Scryfall on first load.
        const missingIds: string[] = (data.deck.cards as { scryfallId: string; oracleText?: string }[])
          .filter((c) => !c.oracleText)
          .map((c) => c.scryfallId)

        if (missingIds.length === 0) return

        fetch("/api/cards/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: missingIds }),
        })
          .then((r) => r.json())
          .then((enrichData) => {
            if (!enrichData.cards) return
            setDeck((d) => {
              if (!d) return d
              return {
                ...d,
                cards: d.cards.map((c) => {
                  const e = enrichData.cards[c.scryfallId]
                  if (!e) return c
                  return {
                    ...c,
                    oracleText: e.oracleText,
                    typeLine: e.typeLine || c.typeLine,
                    colorIdentity: e.colorIdentity.length > 0 ? e.colorIdentity : c.colorIdentity,
                  }
                }),
              }
            })
            setSaved(false) // prompt the user to save so enriched data is persisted
          })
          .catch(() => {}) // best-effort, non-blocking
      })
      .finally(() => setLoading(false))
  }, [deckId])

  const handleCardSelect = useCallback((card: ScryfallCard, isFoil: boolean) => {
    if (!deck) return

    // Legality — block banned and not-legal cards
    const legality = card.legalities?.commander
    if (legality === "banned") {
      addToast("error", `${card.name} is banned in Commander.`)
      return
    }
    if (legality === "not_legal") {
      addToast("error", `${card.name} is not legal in Commander.`)
      return
    }

    // How many copies are allowed for this card
    const cardSnap = { name: card.name, typeLine: card.type_line, oracleText: card.oracle_text ?? "" }
    const limit = getDeckLimit(cardSnap)

    // Total copies of this card name already in deck (all printings combined)
    const currentTotal = deck.cards
      .filter((c) => c.name === card.name)
      .reduce((s, c) => s + c.quantity, 0)

    if (limit !== Infinity && currentTotal >= limit) {
      const msg = limit === 1
        ? `${card.name} is already in your deck.`
        : `A deck can have at most ${limit} copies of ${card.name} (you have ${currentTotal}).`
      addToast("warning", msg)
      return
    }

    // Color identity — union of all commanders
    const commanders = deck.cards.filter((c) => c.isCommander)
    if (commanders.length > 0 && !isBasicLand(card.type_line, card.name)) {
      const cmdColors = new Set(getCombinedColorIdentity(commanders))
      const outside = card.color_identity.filter((c) => !cmdColors.has(c))
      if (outside.length > 0) {
        addToast("error", `${card.name} is outside your commander's color identity.`)
        return
      }
    }

    // For multi-copy cards (basic lands, any-number, limited-count): increment quantity on
    // the same printing if it already exists in the deck, rather than creating a duplicate entry.
    if (limit !== 1) {
      const sameEntry = deck.cards.find((c) => c.scryfallId === card.id && !!c.isFoil === isFoil)
      if (sameEntry) {
        setDeck((d) => d ? {
          ...d,
          cards: d.cards.map((c) =>
            c.scryfallId === card.id && !!c.isFoil === isFoil
              ? { ...c, quantity: c.quantity + 1 }
              : c
          ),
        } : d)
        setSaved(false)
        addToast("success", `${card.name}${isFoil ? " ✦" : ""} ×${sameEntry.quantity + 1}.`)
        return
      }
    }

    const usd = card.prices?.usd ?? null
    const usdFoil = card.prices?.usd_foil ?? null
    const newCard: CardInDeck = {
      scryfallId: card.id,
      name: card.name,
      quantity: 1,
      cmc: card.cmc,
      typeLine: card.type_line,
      colorIdentity: card.color_identity,
      manaCost: card.mana_cost ?? "",
      prices: { usd: usd ?? undefined, usdFoil: usdFoil ?? undefined },
      imageUri: getCardImageUri(card),
      oracleText: card.oracle_text ?? "",
      isCommander: false,
      isFoil,
      hasFoil: card.foil === true || !!card.prices?.usd_foil,
    }

    setDeck((d) => d ? { ...d, cards: [...d.cards, newCard] } : d)
    setSaved(false)
    addToast("success", `${card.name}${isFoil ? " ✦" : ""} added.`)
  }, [deck, addToast])

  const handleRemove = useCallback((scryfallId: string) => {
    setDeck((d) => d ? { ...d, cards: d.cards.filter((c) => c.scryfallId !== scryfallId) } : d)
    setSaved(false)
  }, [])

  const handleQuantityChange = useCallback((scryfallId: string, delta: number) => {
    setDeck((d) => {
      if (!d) return d
      const card = d.cards.find((c) => c.scryfallId === scryfallId)
      if (!card) return d
      const newQty = card.quantity + delta
      if (newQty <= 0) {
        return { ...d, cards: d.cards.filter((c) => c.scryfallId !== scryfallId) }
      }
      // Enforce per-name copy limit
      const limit = getDeckLimit(card)
      if (limit !== Infinity) {
        const otherTotal = d.cards
          .filter((c) => c.name === card.name && c.scryfallId !== scryfallId)
          .reduce((s, c) => s + c.quantity, 0)
        if (newQty + otherTotal > limit) return d
      }
      return { ...d, cards: d.cards.map((c) => c.scryfallId === scryfallId ? { ...c, quantity: newQty } : c) }
    })
    setSaved(false)
  }, [])

  const handleToggleCommander = useCallback((scryfallId: string) => {
    setDeck((d) => {
      if (!d) return d
      const target = d.cards.find((c) => c.scryfallId === scryfallId)
      if (!target) return d

      // Unsetting a commander — always allowed
      if (target.isCommander) {
        return {
          ...d,
          cards: d.cards.map((c) =>
            c.scryfallId === scryfallId ? { ...c, isCommander: false } : c
          ),
        }
      }

      // Check basic eligibility
      if (!isCommanderEligible(target)) {
        addToast(
          "error",
          `${target.name} must be a Legendary Creature, Planeswalker, or Background enchantment to be a commander.`
        )
        return d
      }

      const currentCommanders = d.cards.filter((c) => c.isCommander)

      // No current commander — set freely
      if (currentCommanders.length === 0) {
        return {
          ...d,
          cards: d.cards.map((c) =>
            c.scryfallId === scryfallId ? { ...c, isCommander: true } : c
          ),
        }
      }

      // Two commanders already — can't add a third
      if (currentCommanders.length >= 2) {
        addToast("error", "You already have two commanders. Remove one first.")
        return d
      }

      // One current commander — check if they can co-command
      const check = canCoCommand(currentCommanders[0], target)
      if (check.ok) {
        // Add as partner
        const mode = getPartnerMode(target)
        const label = mode ? partnerModeLabel(mode) : ""
        addToast("success", `${target.name} added as partner commander${label ? ` (${label})` : ""}.`)
        return {
          ...d,
          cards: d.cards.map((c) =>
            c.scryfallId === scryfallId ? { ...c, isCommander: true } : c
          ),
        }
      }

      // Cannot partner — replace the existing commander
      return {
        ...d,
        cards: d.cards.map((c) => ({
          ...c,
          isCommander: c.scryfallId === scryfallId ? true : false,
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

  // Re-fetches oracle text, type line, and color identity for every card in the
  // deck from Scryfall. Run this to pick up errata or to repair a deck that was
  // saved before oracleText was introduced.
  const handleRefreshCardData = async () => {
    if (!deck || refreshing) return
    setRefreshing(true)
    try {
      const allIds = deck.cards.map((c) => c.scryfallId)
      const res = await fetch("/api/cards/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: allIds }),
      })
      const data = await res.json()
      if (!data.cards) throw new Error("empty response")
      setDeck((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            const e = data.cards[c.scryfallId]
            if (!e) return c
            return {
              ...c,
              oracleText: e.oracleText,
              typeLine: e.typeLine || c.typeLine,
              colorIdentity: e.colorIdentity.length > 0 ? e.colorIdentity : c.colorIdentity,
            }
          }),
        }
      })
      setSaved(false)
      addToast("success", "Card data refreshed from Scryfall.")
    } catch {
      addToast("error", "Failed to refresh card data.")
    } finally {
      setRefreshing(false)
    }
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
  const allCommanders = deck.cards.filter((c) => c.isCommander)
  const commanderColorIdentity = getCombinedColorIdentity(allCommanders)

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Editor header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0" style={{ background: "rgba(9,9,11,0.90)", backdropFilter: "blur(12px)" }}>
        <button
          onClick={() => router.push("/decks")}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 px-2 py-1.5 rounded-lg hover:bg-zinc-800/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Decks</span>
        </button>

        <div className="w-px h-5 bg-zinc-800" />

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {editingName ? (
            <form onSubmit={(e) => { e.preventDefault(); handleNameSave() }} className="flex items-center gap-2 flex-1 min-w-0">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                className="flex-1 min-w-0 bg-zinc-800 border border-amber-500/60 rounded-lg px-2.5 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </form>
          ) : (
            <button onClick={() => setEditingName(true)} className="flex items-center gap-2 group min-w-0 px-1 py-1 rounded-lg hover:bg-zinc-800/50">
              <h1 className="text-sm font-semibold text-zinc-100 truncate">{deck.name}</h1>
              <Pencil className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium tabular-nums ${
            validation.cardCount === 100
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
          }`}>
            {validation.cardCount}/100
          </span>

          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-all ${
              saved
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-500/20 disabled:opacity-50"
            }`}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>

          <button
            onClick={handleRefreshCardData}
            disabled={refreshing || saving}
            title="Re-fetch card data from Scryfall — picks up errata and repairs decks missing oracle text"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: card search */}
        <div
          className="w-72 flex-shrink-0 border-r border-white/[0.05] flex flex-col"
          style={{ background: "rgba(7,7,30,0.70)" }}
        >
          <div className="p-3">
            <CardSearch onCardSelect={handleCardSelect} />
          </div>
          <div className="flex-1 flex items-start justify-center p-4 pt-6">
            <p className="text-xs text-zinc-600 text-center leading-relaxed">
              Search for cards above.<br />Hover a result to preview.
            </p>
          </div>
        </div>

        {/* Center: card list */}
        <div className="flex-1 overflow-y-auto" style={{ background: "rgba(7,7,30,0.20)" }}>
          <div className="p-5 space-y-6 max-w-2xl">
            {SECTIONS.map(({ key, label, filter }) => {
              const sectionCards = deck.cards.filter(filter)
              if (sectionCards.length === 0) return null
              const sectionTotal = sectionCards.reduce((s, c) => s + c.quantity, 0)
              const sectionPrice = sectionCards.reduce((s, c) => {
                const p = parseFloat((c.isFoil ? c.prices?.usdFoil : c.prices?.usd) ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
                return s + (isNaN(p) ? 0 : p * c.quantity)
              }, 0)

              return (
                <div key={key}>
                  <div className="flex items-center gap-2.5 mb-2.5 px-1">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.14em]">
                      {label}
                    </span>
                    <span
                      className="text-[10px] font-semibold text-zinc-400 tabular-nums px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {sectionTotal}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <span className="text-[10px] text-zinc-500 tabular-nums">${sectionPrice.toFixed(2)}</span>
                  </div>
                  <div
                    className="space-y-0.5 rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {sectionCards.map((card) => (
                      <CardListItem
                        key={card.scryfallId}
                        card={card}
                        onRemove={handleRemove}
                        onQuantityChange={handleQuantityChange}
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
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4">
                  <Swords className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-zinc-400 text-sm font-semibold">Your deck is empty</p>
                <p className="text-zinc-600 text-xs mt-1.5">Search for cards on the left to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: stats */}
        <div
          className="w-64 flex-shrink-0 border-l border-white/[0.05] overflow-y-auto"
          style={{ background: "rgba(7,7,30,0.70)" }}
        >
          <div className="p-4">
            <DeckStats cards={deck.cards} validation={validation} />
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border backdrop-blur-sm ${
              t.type === "error"   ? "bg-red-950/90 border-red-500/20 text-red-300" :
              t.type === "warning" ? "bg-yellow-950/90 border-yellow-500/20 text-yellow-300" :
                                     "bg-zinc-900/90 border-zinc-700/60 text-zinc-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

