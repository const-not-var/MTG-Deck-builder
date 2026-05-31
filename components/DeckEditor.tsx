"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Save, Trash2, ArrowLeft, Loader2, Check, Pencil, Swords, RefreshCw, ChevronLeft, ChevronRight, FlaskConical } from "lucide-react"
import type { ScryfallCard, CardInDeck, Deck } from "@/types"
import { getCardImageUri, getCardImageUriBack, isBasicLand } from "@/lib/scryfall"
import { validateDeck } from "@/lib/validation"
import { isCommanderEligible, canCoCommand, getCombinedColorIdentity, getPartnerMode, partnerModeLabel } from "@/lib/commander"
import { isCompanionCard } from "@/lib/companion"
import { getDeckLimit } from "@/lib/rules"
import { CardSearch } from "./CardSearch"
import { CardStack, CARD_W } from "./CardStack"
import { DeckStats } from "./DeckStats"
import { PlaytestView } from "./PlaytestView"

const SECTIONS = [
  { key: "commander",     label: "Commander",     color: "#f59e0b", filter: (c: CardInDeck) => c.isCommander },
  { key: "companion",     label: "Companion",     color: "#818cf8", filter: (c: CardInDeck) => !!c.isCompanion },
  { key: "creatures",     label: "Creatures",     color: "#34d399", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Creature") && !c.typeLine.includes("Land") },
  { key: "planeswalkers", label: "Planeswalkers", color: "#a78bfa", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Planeswalker") && !c.typeLine.includes("Creature") },
  { key: "battles",       label: "Battles",       color: "#f87171", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Battle") && !c.typeLine.includes("Creature") },
  { key: "instants",      label: "Instants",      color: "#38bdf8", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Instant") },
  { key: "sorceries",     label: "Sorceries",     color: "#fb923c", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Sorcery") },
  // Exclude Creatures, Enchantments, and Lands so artifact versions of those go to their own section
  { key: "artifacts",     label: "Artifacts",     color: "#a1a1aa", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Artifact") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Enchantment") && !c.typeLine.includes("Land") },
  { key: "enchantments",  label: "Enchantments",  color: "#2dd4bf", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Enchantment") && !c.typeLine.includes("Creature") && !c.typeLine.includes("Artifact") },
  { key: "lands",         label: "Lands",         color: "#d97706", filter: (c: CardInDeck) => !c.isCommander && !c.isCompanion && c.typeLine.includes("Land") },
  // Catch-all for any card type not covered above (e.g. future types)
  {
    key: "other", label: "Other", color: "#6b7280",
    filter: (c: CardInDeck) =>
      !c.isCommander &&
      !c.isCompanion &&
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [playtesting, setPlaytesting] = useState(false)

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const fetchSalt = useCallback((names: string[]) => {
    if (names.length === 0) return
    fetch("/api/cards/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    })
      .then((r) => r.json())
      .then((saltData) => {
        if (!saltData.salt) return
        setDeck((d) => {
          if (!d) return d
          return {
            ...d,
            cards: d.cards.map((c) => {
              const s = saltData.salt[c.name]
              return typeof s === "number" ? { ...c, salt: s } : c
            }),
          }
        })
        setSaved(false)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/decks/${deckId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.deck) return
        setDeck(data.deck)
        setNameInput(data.deck.name)

        // Backfill fields added after initial save (oracleText, purchase URLs, back-face image, loyalty).
        // imageUriBack is only present on DFCs — use oracleText/tcgplayerUrl absence as the trigger.
        const missingIds: string[] = (data.deck.cards as { scryfallId: string; oracleText?: string; tcgplayerUrl?: string; imageUriBack?: string; typeLine?: string; loyalty?: string }[])
          .filter((c) => !c.oracleText || !c.tcgplayerUrl || c.imageUriBack === undefined || (/planeswalker/i.test(c.typeLine ?? "") && !c.loyalty))
          .map((c) => c.scryfallId)

        if (missingIds.length > 0) {
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
                      tcgplayerUrl: e.tcgplayerUrl ?? c.tcgplayerUrl,
                      cardKingdomUrl: e.cardKingdomUrl ?? c.cardKingdomUrl,
                      imageUriBack: e.imageUriBack ?? c.imageUriBack,
                      loyalty: e.loyalty ?? c.loyalty,
                      colorIdentity: e.colorIdentity.length > 0 ? e.colorIdentity : c.colorIdentity,
                    }
                  }),
                }
              })
              setSaved(false)
            })
            .catch(() => {})
        }

        // Backfill salt scores for cards that don't have them yet
        const missingSalt: string[] = (data.deck.cards as { name: string; salt?: number }[])
          .filter((c) => c.salt === undefined || c.salt === null)
          .map((c) => c.name)
        fetchSalt(missingSalt)
      })
      .finally(() => setLoading(false))
  }, [deckId, fetchSalt])

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
      imageUriBack: getCardImageUriBack(card),
      oracleText: card.oracle_text ?? "",
      isCommander: false,
      isFoil,
      hasFoil: card.foil === true || !!card.prices?.usd_foil,
      tcgplayerUrl: card.purchase_uris?.tcgplayer,
      cardKingdomUrl: card.purchase_uris?.cardkingdom,
      loyalty: card.loyalty,
    }

    setDeck((d) => d ? { ...d, cards: [...d.cards, newCard] } : d)
    setSaved(false)
    addToast("success", `${card.name}${isFoil ? " ✦" : ""} added.`)

    // Fetch salt for this card if not already in the deck
    const alreadyInDeck = deck.cards.some((c) => c.name === card.name && c.salt !== undefined)
    if (!alreadyInDeck) fetchSalt([card.name])
  }, [deck, addToast, fetchSalt])

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

  const handleToggleCompanion = useCallback((scryfallId: string) => {
    setDeck((d) => {
      if (!d) return d
      const target = d.cards.find((c) => c.scryfallId === scryfallId)
      if (!target) return d

      // Unsetting companion — always allowed
      if (target.isCompanion) {
        return { ...d, cards: d.cards.map((c) => c.scryfallId === scryfallId ? { ...c, isCompanion: false } : c) }
      }

      if (!isCompanionCard(target)) {
        addToast("error", `${target.name} does not have the Companion ability.`)
        return d
      }

      const currentCompanions = d.cards.filter((c) => c.isCompanion)
      if (currentCompanions.length >= 1) {
        addToast("error", "A deck can only have one companion. Remove the existing one first.")
        return d
      }

      // A card cannot be both commander and companion
      return {
        ...d,
        cards: d.cards.map((c) =>
          c.scryfallId === scryfallId ? { ...c, isCompanion: true, isCommander: false } : c
        ),
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
              tcgplayerUrl: e.tcgplayerUrl ?? c.tcgplayerUrl,
              cardKingdomUrl: e.cardKingdomUrl ?? c.cardKingdomUrl,
              imageUriBack: e.imageUriBack ?? c.imageUriBack,
              loyalty: e.loyalty ?? c.loyalty,
              colorIdentity: e.colorIdentity.length > 0 ? e.colorIdentity : c.colorIdentity,
            }
          }),
        }
      })
      setSaved(false)
      addToast("success", "Card data refreshed from Scryfall.")

      // Also refresh salt scores for all cards
      fetchSalt(deck.cards.map((c) => c.name))
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
  const companion = deck.cards.find((c) => c.isCompanion)
  const commanderColorIdentity = getCombinedColorIdentity(allCommanders)

  const saltedCards = deck.cards.filter((c) => c.salt !== undefined)
  const totalSalt = saltedCards.reduce((s, c) => s + (c.salt ?? 0), 0)
  const saltLoaded = saltedCards.length > 0
  const saltColor = totalSalt < 7 ? "#22c55e" : totalSalt < 15 ? "#14b8a6" : totalSalt < 25 ? "#eab308" : totalSalt < 40 ? "#f97316" : "#ef4444"

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Editor header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0"
        style={{ background: "rgba(6,7,30,0.94)", backdropFilter: "blur(20px)" }}
      >
        <button
          onClick={() => router.push("/decks")}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Decks</span>
        </button>

        <div className="w-px h-6 bg-white/[0.08]" />

        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          {editingName ? (
            <form onSubmit={(e) => { e.preventDefault(); handleNameSave() }} className="flex items-center gap-2 flex-1 min-w-0">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                className="flex-1 min-w-0 bg-zinc-800/80 border border-amber-500/60 rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </form>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-2 group min-w-0 py-0.5 rounded-lg hover:bg-white/[0.05] px-1 transition-colors"
              >
                <h1 className="text-base font-bold text-zinc-100 truncate">{deck.name}</h1>
                <Pencil className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
              </button>
            </div>
          )}
          {allCommanders.length > 0 && (
            <p className="text-xs text-zinc-500 truncate pl-1">
              {allCommanders.map((c) => c.name).join(" · ")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Salt meter */}
          <div
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl cursor-default"
            title="Total deck salt — sum of all cards' EDHREC salt scores"
            style={{
              background: saltLoaded ? `${saltColor}12` : "rgba(255,255,255,0.04)",
              border: saltLoaded ? `1px solid ${saltColor}30` : "1px solid rgba(255,255,255,0.07)",
              transition: "all 0.5s",
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">🧂</span>
              <span
                className="text-lg font-bold tabular-nums leading-none"
                style={{ color: saltLoaded ? saltColor : "#52525b", transition: "color 0.5s" }}
              >
                {saltLoaded ? totalSalt.toFixed(1) : "—"}
              </span>
            </div>
            <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: saltLoaded ? saltColor : "#52525b", opacity: 0.7 }}>
              Salt
            </span>
          </div>

          <div className="w-px h-8 bg-white/[0.06]" />

          {/* Card count */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold tabular-nums ${
                validation.cardCount === 100
                  ? "bg-green-500/15 text-green-400 border border-green-500/25"
                  : validation.cardCount > 100
                  ? "bg-red-500/15 text-red-400 border border-red-500/25"
                  : "bg-white/[0.06] text-zinc-400 border border-white/[0.08]"
              }`}>
                {validation.cardCount}/100
              </span>
              {companion && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(129,140,248,0.15)", border: "1px solid rgba(129,140,248,0.3)", color: "#818cf8" }}>
                  +C
                </span>
              )}
            </div>
            <div className="w-20 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  validation.cardCount === 100 ? "bg-green-500" :
                  validation.cardCount > 100 ? "bg-red-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min((validation.cardCount / 100) * 100, 100)}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setPlaytesting(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.07] border border-white/[0.07] transition-all"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Playtest
          </button>

          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? "bg-green-500/15 text-green-400 border border-green-500/25"
                : "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            }`}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>

          <button
            onClick={handleRefreshCardData}
            disabled={refreshing || saving}
            title="Re-fetch card data from Scryfall — picks up errata and repairs decks missing oracle text"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: card search */}
        <div
          className="flex-shrink-0 border-r flex flex-col overflow-hidden"
          style={{
            width: leftOpen ? 288 : 0,
            transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
            background: "rgba(6,7,30,0.60)",
            borderColor: leftOpen ? "rgba(255,255,255,0.05)" : "transparent",
          }}
        >
          <div
            className="flex flex-col h-full"
            style={{ width: 288, opacity: leftOpen ? 1 : 0, transition: "opacity 0.2s", pointerEvents: leftOpen ? "auto" : "none" }}
          >
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-amber-500/80 flex-shrink-0" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Add Cards</span>
              </div>
              <CardSearch onCardSelect={handleCardSelect} />
            </div>
            <div className="flex-1 flex items-start justify-center p-4 pt-2">
              <p className="text-xs text-zinc-700 text-center leading-relaxed">
                Search above and click a<br />printing to add it to your deck.
              </p>
            </div>
          </div>
        </div>

        {/* Center: horizontal solitaire-style card columns */}
        <div className="flex-1 relative overflow-hidden flex flex-col" style={{ background: "rgba(6,7,30,0.15)" }}>
          {/* Panel toggle buttons — always visible in top corners */}
          <div className="absolute top-3 left-3 z-20">
            <button
              onClick={() => setLeftOpen((o) => !o)}
              title={leftOpen ? "Collapse search" : "Expand search"}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-zinc-600 hover:text-zinc-200 transition-all hover:bg-white/[0.07]"
              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,7,30,0.7)", backdropFilter: "blur(8px)" }}
            >
              <ChevronLeft className="w-3 h-3 transition-transform duration-300" style={{ transform: leftOpen ? "rotate(0deg)" : "rotate(180deg)" }} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Search</span>
            </button>
          </div>
          <div className="absolute top-3 right-3 z-20">
            <button
              onClick={() => setRightOpen((o) => !o)}
              title={rightOpen ? "Collapse stats" : "Expand stats"}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-zinc-600 hover:text-zinc-200 transition-all hover:bg-white/[0.07]"
              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,7,30,0.7)", backdropFilter: "blur(8px)" }}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest">Stats</span>
              <ChevronRight className="w-3 h-3 transition-transform duration-300" style={{ transform: rightOpen ? "rotate(0deg)" : "rotate(180deg)" }} />
            </button>
          </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto select-none"
          style={{ cursor: drag.current.active ? "grabbing" : "grab" }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return
            drag.current = { active: true, startX: e.pageX, scrollLeft: scrollRef.current?.scrollLeft ?? 0 }
          }}
          onMouseMove={(e) => {
            if (!drag.current.active || !scrollRef.current) return
            e.preventDefault()
            scrollRef.current.scrollLeft = drag.current.scrollLeft - (e.pageX - drag.current.startX)
          }}
          onMouseUp={() => { drag.current.active = false }}
          onMouseLeave={() => { drag.current.active = false }}
        >
          <div className="flex gap-5 p-5 pb-10 pt-12 items-start" style={{ minWidth: "max-content" }}>
            {SECTIONS.map(({ key, label, color, filter }) => {
              const sectionCards = deck.cards.filter(filter)
              if (sectionCards.length === 0) return null
              const sectionTotal = sectionCards.reduce((s, c) => s + c.quantity, 0)
              const sectionPrice = sectionCards.reduce((s, c) => {
                const p = parseFloat((c.isFoil ? c.prices?.usdFoil : c.prices?.usd) ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
                return s + (isNaN(p) ? 0 : p * c.quantity)
              }, 0)

              return (
                <div key={key} className="flex-shrink-0" style={{ width: CARD_W }}>
                  {/* Column header */}
                  <div className="mb-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color }}>
                        {label}
                      </span>
                      <span
                        className="text-[9px] font-semibold tabular-nums px-1 py-0.5 rounded flex-shrink-0"
                        style={{ background: `${color}18`, border: `1px solid ${color}28`, color }}
                      >
                        {sectionTotal}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${color}40, transparent)` }} />
                      <span className="text-[9px] text-zinc-600 tabular-nums ml-1.5">${sectionPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Solitaire card stack */}
                  <CardStack
                    cards={sectionCards}
                    onRemove={handleRemove}
                    onQuantityChange={handleQuantityChange}
                    onToggleCommander={handleToggleCommander}
                    onToggleCompanion={handleToggleCompanion}
                    commanderColorIdentity={commanderColorIdentity}
                    hasCommander={!!commander}
                  />
                </div>
              )
            })}

            {deck.cards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.15)",
                    boxShadow: "0 0 40px rgba(245,158,11,0.05)",
                  }}
                >
                  <Swords className="w-7 h-7 text-amber-500/60" />
                </div>
                <p className="text-zinc-300 text-sm font-semibold mb-1.5">Your deck is empty</p>
                <p className="text-zinc-600 text-xs leading-relaxed">
                  Search for cards on the left to start<br />building your Commander deck.
                </p>
              </div>
            )}
          </div>
        </div>
        </div>{/* end center wrapper */}

        {/* Right: stats */}
        <div
          className="flex-shrink-0 border-l flex flex-col overflow-hidden"
          style={{
            width: rightOpen ? 288 : 0,
            transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
            background: "rgba(6,7,30,0.60)",
            borderColor: rightOpen ? "rgba(255,255,255,0.05)" : "transparent",
          }}
        >
          <div
            className="flex flex-col h-full overflow-y-auto"
            style={{ width: 288, opacity: rightOpen ? 1 : 0, transition: "opacity 0.2s", pointerEvents: rightOpen ? "auto" : "none" }}
          >
            <DeckStats cards={deck.cards} validation={validation} />
          </div>
        </div>
      </div>

      {/* Playtester overlay */}
      {playtesting && <PlaytestView cards={deck.cards} onClose={() => setPlaytesting(false)} />}

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

