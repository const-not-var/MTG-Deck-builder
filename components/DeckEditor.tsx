"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Save, Trash2, ArrowLeft, Loader2, Check, Pencil, Swords, RefreshCw, ChevronLeft, ChevronRight, FlaskConical, Search, Layers, BarChart2, Upload, Copy, X, ChevronDown } from "lucide-react"
import type { ScryfallCard, CardInDeck, Deck } from "@/types"
import { getCardImageUri, getCardImageUriBack, isBasicLand } from "@/lib/scryfall"
import { validateDeck } from "@/lib/validation"
import { isCommanderEligible, canCoCommand, getCombinedColorIdentity, getPartnerMode, partnerModeLabel } from "@/lib/commander"
import { isCompanionCard } from "@/lib/companion"
import { getDeckLimit } from "@/lib/rules"
import { toast } from "sonner"
import { CardSearch } from "./CardSearch"
import { CardStack, CARD_W } from "./CardStack"
import { CardListItem } from "./CardListItem"
import { DeckStats } from "./DeckStats"
import { PlaytestView } from "./PlaytestView"
import { ConfirmDialog } from "./ConfirmDialog"

// Signature of the user-editable contents of a deck (ignores enrich/salt metadata),
// used to detect unsaved changes.
function deckSignature(d: Deck): string {
  return JSON.stringify({
    n: d.name,
    de: d.description ?? "",
    c: d.cards.map(c => `${c.scryfallId}:${c.quantity}:${c.isCommander ? 1 : 0}:${c.isCompanion ? 1 : 0}:${c.isFoil ? 1 : 0}`),
  })
}

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const removedCardRef = useRef<CardInDeck | null>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [playtesting, setPlaytesting] = useState(false)
  const [mobileTab, setMobileTab] = useState<"search" | "cards" | "stats">("cards")
  const [isMobile, setIsMobile] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)
  // User-validation: confirm before removing a card / leaving with unsaved changes.
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const savedSigRef = useRef("")
  const [showFillBasics, setShowFillBasics] = useState(false)
  const [basicCounts, setBasicCounts] = useState({ Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
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
        savedSigRef.current = deckSignature(data.deck)   // baseline for unsaved-change detection
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
      toast.error(`${card.name} is banned in Commander.`)
      return
    }
    if (legality === "not_legal") {
      toast.error(`${card.name} is not legal in Commander.`)
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
      toast.warning(msg)
      return
    }

    // Color identity — union of all commanders
    const commanders = deck.cards.filter((c) => c.isCommander)
    if (commanders.length > 0 && !isBasicLand(card.type_line, card.name)) {
      const cmdColors = new Set(getCombinedColorIdentity(commanders))
      const outside = card.color_identity.filter((c) => !cmdColors.has(c))
      if (outside.length > 0) {
        toast.error(`${card.name} is outside your commander's color identity.`)
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
        toast.success(`${card.name}${isFoil ? " ✦" : ""} ×${sameEntry.quantity + 1}.`)
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
    toast.success(`${card.name}${isFoil ? " ✦" : ""} added.`)

    // Fetch salt for this card if not already in the deck
    const alreadyInDeck = deck.cards.some((c) => c.name === card.name && c.salt !== undefined)
    if (!alreadyInDeck) fetchSalt([card.name])
  }, [deck, fetchSalt])

  const handleRemove = useCallback((scryfallId: string) => {
    setDeck((d) => d ? { ...d, cards: d.cards.filter((c) => c.scryfallId !== scryfallId) } : d)
    setSaved(false)
  }, [])

  const handleRemoveWithUndo = useCallback((scryfallId: string) => {
    setDeck((d) => {
      if (!d) return d
      const card = d.cards.find((c) => c.scryfallId === scryfallId)
      if (card) removedCardRef.current = card
      return { ...d, cards: d.cards.filter((c) => c.scryfallId !== scryfallId) }
    })
    setSaved(false)
    toast(`Removed ${removedCardRef.current?.name ?? "card"}`, {
      action: {
        label: "Undo",
        onClick: () => {
          const card = removedCardRef.current
          if (!card) return
          setDeck((d) => d ? { ...d, cards: [...d.cards, card] } : d)
          setSaved(false)
          removedCardRef.current = null
        },
      },
    })
  }, [])

  const handleDuplicate = useCallback(async () => {
    if (!deck) return
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${deck.name} (Copy)`, cards: deck.cards }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Deck duplicated", {
        action: { label: "Open", onClick: () => router.push(`/decks/${data.deck._id}`) },
      })
    } catch {
      toast.error("Failed to duplicate deck.")
    }
  }, [deck, router])

  const parseDecklist = (text: string): Array<{ quantity: number; name: string }> => {
    const entries: Array<{ quantity: number; name: string }> = []
    for (const raw of text.split("\n")) {
      const line = raw.trim().replace(/^SB:\s*/i, "")
      if (!line || line.startsWith("//") || line.startsWith("#")) continue
      // Matches: "1 Sol Ring", "1x Sol Ring", "4 Forest (LCI) 280"
      const m = line.match(/^(\d+)x?\s+(.+?)(?:\s+\([A-Z0-9]{2,6}\)\s+\d+.*)?$/)
      if (!m) continue
      const qty = Math.min(parseInt(m[1]), 99)
      const name = m[2].trim()
      if (name) entries.push({ quantity: qty, name })
    }
    return entries
  }

  const handleImport = async () => {
    if (!deck || !importText.trim()) return
    setImporting(true)
    try {
      const entries = parseDecklist(importText)
      if (entries.length === 0) {
        toast.error("No cards found. Use format: '1 Sol Ring'")
        return
      }

      // Merge duplicate names, summing quantities
      const nameQtyMap = new Map<string, number>()
      for (const { quantity, name } of entries) {
        nameQtyMap.set(name, (nameQtyMap.get(name) ?? 0) + quantity)
      }

      const res = await fetch("/api/cards/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: [...nameQtyMap.keys()] }),
      })
      if (!res.ok) throw new Error("API error")
      const data = await res.json()

      const cardMap = new Map<string, ScryfallCard>()
      for (const card of data.cards ?? []) {
        cardMap.set(card.name.toLowerCase(), card)
      }
      const aliases: Record<string, string> = data.aliases ?? {}   // requested name → fuzzy-resolved card name

      const toAdd: CardInDeck[] = []
      const notImported: string[] = []
      const corrected: string[] = []   // requested → fuzzy-resolved, so a bad auto-correction is visible

      for (const [name, qty] of nameQtyMap) {
        const resolvedName = (aliases[name.toLowerCase()] ?? name).toLowerCase()
        const card = cardMap.get(resolvedName)
        if (!card) { notImported.push(name); continue }

        const legality = card.legalities?.commander
        if (legality === "banned" || legality === "not_legal") { notImported.push(`${card.name} (not Commander-legal)`); continue }

        const limit = getDeckLimit({ name: card.name, typeLine: card.type_line, oracleText: card.oracle_text ?? "" })
        const existingQty = deck.cards.filter((c) => c.name === card.name).reduce((s, c) => s + c.quantity, 0)
        const available = limit === Infinity ? qty : Math.max(0, limit - existingQty)
        if (available === 0) { notImported.push(`${card.name} (already at max copies)`); continue }

        // Card came in under a different name than typed — flag the correction.
        if (card.name.toLowerCase() !== name.toLowerCase()) corrected.push(`"${name}" → ${card.name}`)

        toAdd.push({
          scryfallId: card.id,
          name: card.name,
          quantity: Math.min(qty, available),
          cmc: card.cmc,
          typeLine: card.type_line,
          colorIdentity: card.color_identity,
          manaCost: card.mana_cost ?? "",
          prices: { usd: card.prices?.usd ?? undefined, usdFoil: card.prices?.usd_foil ?? undefined },
          imageUri: getCardImageUri(card),
          imageUriBack: getCardImageUriBack(card),
          oracleText: card.oracle_text ?? "",
          isCommander: false,
          isFoil: false,
          hasFoil: !!(card.foil && card.prices?.usd_foil),
          tcgplayerUrl: card.purchase_uris?.tcgplayer,
          cardKingdomUrl: card.purchase_uris?.cardkingdom,
          loyalty: card.loyalty,
        })
      }

      const totalAdded = toAdd.reduce((s, c) => s + c.quantity, 0)

      setDeck((d) => d ? { ...d, cards: [...d.cards, ...toAdd] } : d)
      setSaved(false)
      setShowImport(false)
      setImportText("")

      if (totalAdded > 0) {
        toast.success(`Imported ${totalAdded} card${totalAdded !== 1 ? "s" : ""}.`)
      } else if (notImported.length === 0) {
        toast.warning("No new cards added — they were already in your deck.")
      }
      // Surface fuzzy auto-corrections so a wrong guess can be caught.
      if (corrected.length > 0) {
        toast.info(`Auto-corrected ${corrected.length} spelling${corrected.length !== 1 ? "s" : ""} — check these:`, {
          description: corrected.join(", "),
          duration: 15000,
        })
      }
      // Always surface exactly which cards couldn't be imported, so nothing is lost silently.
      if (notImported.length > 0) {
        toast.warning(`Couldn't import ${notImported.length} card${notImported.length !== 1 ? "s" : ""} — check spelling:`, {
          description: notImported.join(", "),
          duration: 15000,
        })
      }

      if (toAdd.length > 0) fetchSalt(toAdd.map((c) => c.name))
    } catch {
      toast.error("Import failed. Check your format and try again.")
    } finally {
      setImporting(false)
    }
  }

  const handleFillBasics = async () => {
    const names = (Object.entries(basicCounts) as [string, number][])
      .filter(([, qty]) => qty > 0)
      .map(([name]) => name)
    if (names.length === 0) return

    const res = await fetch("/api/cards/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    })
    if (!res.ok) { toast.error("Failed to fetch basic land data."); return }
    const data = await res.json()

    const cardMap = new Map<string, ScryfallCard>()
    for (const card of data.cards ?? []) cardMap.set(card.name.toLowerCase(), card)

    const toAdd: CardInDeck[] = []
    for (const [name, qty] of Object.entries(basicCounts) as [string, number][]) {
      if (qty <= 0) continue
      const card = cardMap.get(name.toLowerCase())
      if (!card) continue
      toAdd.push({
        scryfallId: card.id,
        name: card.name,
        quantity: qty,
        cmc: card.cmc,
        typeLine: card.type_line,
        colorIdentity: card.color_identity,
        manaCost: card.mana_cost ?? "",
        prices: { usd: card.prices?.usd ?? undefined, usdFoil: card.prices?.usd_foil ?? undefined },
        imageUri: getCardImageUri(card),
        imageUriBack: getCardImageUriBack(card),
        oracleText: card.oracle_text ?? "",
        isCommander: false,
        isFoil: false,
        hasFoil: false,
        tcgplayerUrl: card.purchase_uris?.tcgplayer,
        cardKingdomUrl: card.purchase_uris?.cardkingdom,
      })
    }

    const total = toAdd.reduce((s, c) => s + c.quantity, 0)
    setDeck((d) => d ? { ...d, cards: [...d.cards, ...toAdd] } : d)
    setSaved(false)
    setBasicCounts({ Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 })
    setShowFillBasics(false)
    toast.success(`Added ${total} basic land${total !== 1 ? "s" : ""}.`)
  }

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
        toast.error(`${target.name} must be a Legendary Creature, Planeswalker, or Background enchantment to be a commander.`)
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
        toast.error("You already have two commanders. Remove one first.")
        return d
      }

      // One current commander — check if they can co-command
      const check = canCoCommand(currentCommanders[0], target)
      if (check.ok) {
        // Add as partner
        const mode = getPartnerMode(target)
        const label = mode ? partnerModeLabel(mode) : ""
        toast.success(`${target.name} added as partner commander${label ? ` (${label})` : ""}.`)
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
  }, [])

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
        toast.error(`${target.name} does not have the Companion ability.`)
        return d
      }

      const currentCompanions = d.cards.filter((c) => c.isCompanion)
      if (currentCompanions.length >= 1) {
        toast.error("A deck can only have one companion. Remove the existing one first.")
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
  }, [])

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
      setSavedAt(new Date())
      savedSigRef.current = deckSignature(deck)   // current state is now the saved baseline
      toast.success("Deck saved!")
    } catch {
      toast.error("Failed to save. Try again.")
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
      toast.error("Failed to delete. Try again.")
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
      toast.success("Card data refreshed from Scryfall.")

      // Also refresh salt scores for all cards
      fetchSalt(deck.cards.map((c) => c.name))
    } catch {
      toast.error("Failed to refresh card data.")
    } finally {
      setRefreshing(false)
    }
  }

  const dirty = !!deck && deckSignature(deck) !== savedSigRef.current

  // Warn on tab close / refresh while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const leave = () => { if (dirty) setConfirmLeave(true); else router.push("/decks") }

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
    <div
      className="flex flex-col flex-1"
      style={{ overflowX: "hidden", overflowY: isMobile && mobileTab === "cards" ? "auto" : "hidden", overscrollBehavior: "contain" }}
    >
      {/* Editor header */}
      <div
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 border-b border-white/[0.06] flex-shrink-0"
        style={{
          background: "rgba(6,7,30,0.94)",
          backdropFilter: "blur(20px)",
          ...(isMobile ? { position: "sticky", top: 0, zIndex: 40 } : {}),
        }}
      >
        <button
          onClick={leave}
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

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Salt meter — hidden on mobile */}
          <div
            className="hidden md:flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl cursor-default"
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

          <div className="hidden md:block w-px h-8 bg-white/[0.06]" />

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
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.07] border border-white/[0.07] transition-all"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Playtest
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-sm font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.07] border border-white/[0.07] transition-all"
            aria-label="Import decklist"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Import</span>
          </button>

          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              aria-label={saving ? "Saving…" : saved ? "Saved" : "Save deck"}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                saved
                  ? "bg-green-500/15 text-green-400 border border-green-500/25"
                  : "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              }`}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{saving ? "Saving…" : saved ? "Saved" : "Save"}</span>
            </button>
            {savedAt && saved && (
              <span className="text-[9px] text-zinc-600 tabular-nums pr-0.5">
                {(() => {
                  const diff = Math.floor((Date.now() - savedAt.getTime()) / 1000)
                  if (diff < 10) return "just now"
                  if (diff < 60) return `${diff}s ago`
                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
                  return savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                })()}
              </span>
            )}
          </div>

          <button
            onClick={handleRefreshCardData}
            disabled={refreshing || saving}
            aria-label="Re-fetch card data from Scryfall"
            title="Re-fetch card data from Scryfall — picks up errata and repairs decks missing oracle text"
            className="hidden sm:block p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDuplicate}
            aria-label="Duplicate deck"
            title="Duplicate this deck"
            className="hidden sm:block p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete deck"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className={`flex ${isMobile && mobileTab === "cards" ? "" : "flex-1 overflow-hidden"}`}>
        {/* Left: card search */}
        <div
          className={`flex-shrink-0 border-r flex flex-col ${isMobile && mobileTab === "cards" ? "" : "overflow-hidden"}`}
          style={{
            width: isMobile ? (mobileTab === "search" ? "100%" : 0) : leftOpen ? 288 : 0,
            transition: isMobile ? "none" : "width 0.35s cubic-bezier(0.4,0,0.2,1)",
            background: "rgba(6,7,30,0.60)",
            borderColor: (isMobile ? mobileTab === "search" : leftOpen) ? "rgba(255,255,255,0.05)" : "transparent",
          }}
        >
          <div
            className={`flex flex-col ${isMobile && mobileTab === "cards" ? "" : "h-full"}`}
            style={{ width: isMobile ? "100%" : 288, opacity: (isMobile ? mobileTab === "search" : leftOpen) ? 1 : 0, transition: isMobile ? "none" : "opacity 0.2s", pointerEvents: (isMobile ? mobileTab === "search" : leftOpen) ? "auto" : "none" }}
          >
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-amber-500/80 flex-shrink-0" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Add Cards</span>
              </div>
              <CardSearch onCardSelect={handleCardSelect} />
            </div>

            {/* Fill Basics */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowFillBasics((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors border border-white/[0.05]"
              >
                <span className="text-xs font-semibold">Fill Basic Lands</span>
                <div className="flex items-center gap-1.5">
                  {validation.cardCount < 100 && (
                    <span className="text-[10px] tabular-nums text-zinc-600">{100 - validation.cardCount} slots left</span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFillBasics ? "rotate-180" : ""}`} />
                </div>
              </button>

              {showFillBasics && (
                <div className="mt-2 p-3 rounded-xl space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {(["Plains", "Island", "Swamp", "Mountain", "Forest"] as const).map((land) => (
                    <div key={land} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-400 w-20">{land}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setBasicCounts((c) => ({ ...c, [land]: Math.max(0, c[land] - 1) }))}
                          aria-label={`Remove one ${land}`}
                          className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 font-bold text-sm transition-colors"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold text-zinc-200 tabular-nums w-5 text-center">
                          {basicCounts[land]}
                        </span>
                        <button
                          onClick={() => setBasicCounts((c) => ({ ...c, [land]: c[land] + 1 }))}
                          aria-label={`Add one ${land}`}
                          className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 font-bold text-sm transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  {(() => {
                    const total = Object.values(basicCounts).reduce((s, n) => s + n, 0)
                    const remaining = 100 - validation.cardCount
                    return (
                      <button
                        onClick={handleFillBasics}
                        disabled={total === 0 || total > remaining}
                        className="w-full mt-1 py-2 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {total === 0 ? "Select basics above" : total > remaining ? `Too many (${total} > ${remaining} slots)` : `Add ${total} land${total !== 1 ? "s" : ""}`}
                      </button>
                    )
                  })()}
                </div>
              )}
            </div>

            <div className="flex-1" />
          </div>
        </div>

        {/* Center: horizontal solitaire-style card columns */}
        <div
          className={`flex-1 relative flex flex-col ${isMobile && mobileTab === "cards" ? "" : "overflow-hidden"}`}
          style={{ background: "rgba(6,7,30,0.15)", display: isMobile && mobileTab !== "cards" ? "none" : "flex" }}
        >
          {/* Panel toggle buttons — desktop only */}
          {!isMobile && (
            <>
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
            </>
          )}

        {/* Mobile: vertical scrollable card list */}
        {isMobile ? (
          <div>
            {deck.cards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  <Swords className="w-6 h-6 text-amber-500/60" />
                </div>
                <p className="text-zinc-300 text-sm font-semibold mb-1">Your deck is empty</p>
                <p className="text-zinc-500 text-xs leading-relaxed">Tap the Search tab to add cards.</p>
              </div>
            ) : (
              SECTIONS.map(({ key, label, color, filter }) => {
                const sectionCards = deck.cards.filter(filter)
                if (sectionCards.length === 0) return null
                const sectionTotal = sectionCards.reduce((s, c) => s + c.quantity, 0)
                const sectionPrice = sectionCards.reduce((s, c) => {
                  const p = parseFloat((c.isFoil ? c.prices?.usdFoil : c.prices?.usd) ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
                  return s + (isNaN(p) ? 0 : p * c.quantity)
                }, 0)
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 px-4 py-2"
                      style={{ background: "rgba(6,7,30,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
                      <span className="text-[9px] font-semibold tabular-nums px-1 py-0.5 rounded"
                        style={{ background: `${color}18`, border: `1px solid ${color}28`, color }}>{sectionTotal}</span>
                      <span className="text-[9px] text-zinc-600 tabular-nums ml-auto">${sectionPrice.toFixed(2)}</span>
                    </div>
                    {sectionCards.map((card) => (
                      <CardListItem
                        key={card.scryfallId}
                        card={card}
                        onRemove={(id) => setPendingRemove(id)}
                        onQuantityChange={handleQuantityChange}
                        onToggleCommander={handleToggleCommander}
                        commanderColorIdentity={commanderColorIdentity}
                        hasCommander={!!commander}
                        alwaysShowActions
                      />
                    ))}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          /* Desktop: horizontal solitaire card stacks */
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
                    <div className="mb-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color }}>{label}</span>
                        <span className="text-[9px] font-semibold tabular-nums px-1 py-0.5 rounded flex-shrink-0"
                          style={{ background: `${color}18`, border: `1px solid ${color}28`, color }}>{sectionTotal}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${color}40, transparent)` }} />
                        <span className="text-[9px] text-zinc-600 tabular-nums ml-1.5">${sectionPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    <CardStack
                      cards={sectionCards}
                      onRemove={(id) => setPendingRemove(id)}
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
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", boxShadow: "0 0 40px rgba(245,158,11,0.05)" }}>
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
        )}
        </div>{/* end center wrapper */}

        {/* Right: stats */}
        <div
          className={`flex-shrink-0 border-l flex flex-col ${isMobile && mobileTab === "cards" ? "" : "overflow-hidden"}`}
          style={{
            width: isMobile ? (mobileTab === "stats" ? "100%" : 0) : rightOpen ? 288 : 0,
            transition: isMobile ? "none" : "width 0.35s cubic-bezier(0.4,0,0.2,1)",
            background: "rgba(6,7,30,0.60)",
            borderColor: (isMobile ? mobileTab === "stats" : rightOpen) ? "rgba(255,255,255,0.05)" : "transparent",
          }}
        >
          <div
            className={`flex flex-col ${isMobile && mobileTab === "cards" ? "" : "h-full overflow-y-auto"}`}
            style={{ width: isMobile ? "100%" : 288, opacity: (isMobile ? mobileTab === "stats" : rightOpen) ? 1 : 0, transition: isMobile ? "none" : "opacity 0.2s", pointerEvents: (isMobile ? mobileTab === "stats" : rightOpen) ? "auto" : "none" }}
          >
            <DeckStats cards={deck.cards} validation={validation} />
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <div
          className="flex-shrink-0 border-t"
          style={{ background: "rgba(6,7,30,0.97)", borderColor: "rgba(255,255,255,0.06)", position: mobileTab === "cards" ? "sticky" : "relative", bottom: mobileTab === "cards" ? 0 : undefined, zIndex: 50 }}
        >
          <div className="flex">
            {([
              { key: "search", label: "Search", Icon: Search },
              { key: "cards",  label: "Cards",  Icon: Layers },
              { key: "stats",  label: "Stats",  Icon: BarChart2 },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMobileTab(key)}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
                style={{ color: mobileTab === key ? "#f59e0b" : "#52525b" }}
                aria-label={label}
                aria-current={mobileTab === key ? "page" : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              </button>
            ))}
          </div>
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      )}

      {/* Playtester overlay — desktop only */}
      {playtesting && !isMobile && <PlaytestView cards={deck.cards} onClose={() => setPlaytesting(false)} />}

      {/* Confirm removing a card */}
      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove this card?"
        message={`"${deck.cards.find(c => c.scryfallId === pendingRemove)?.name ?? "This card"}" will be removed from the deck.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => { if (pendingRemove) handleRemoveWithUndo(pendingRemove); setPendingRemove(null) }}
        onCancel={() => setPendingRemove(null)}
      />

      {/* Confirm leaving with unsaved changes */}
      <ConfirmDialog
        open={confirmLeave}
        title="Leave without saving?"
        message="You have unsaved changes to this deck that will be lost."
        confirmLabel="Leave"
        danger
        onConfirm={() => router.push("/decks")}
        onCancel={() => setConfirmLeave(false)}
      />

      {/* Import modal */}
      {showImport && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowImport(false); setImportText("") } }}
        >
          <div
            className="w-full max-w-lg animate-scale-in"
            style={{
              background: "rgba(10,10,22,0.97)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 30px 60px rgba(0,0,0,0.7)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-zinc-100">Import Decklist</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Paste a list from Moxfield, EDHREC, or any standard format</p>
              </div>
              <button
                onClick={() => { setShowImport(false); setImportText("") }}
                aria-label="Close import"
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              autoFocus
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"1 Sol Ring\n1 Command Tower\n4 Forest\n1 Atraxa, Praetors' Voice\n..."}
              rows={12}
              className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 font-mono resize-none"
            />

            <div className="flex items-center justify-between mt-4 gap-3">
              <p className="text-[11px] text-zinc-600">
                {parseDecklist(importText).reduce((s, e) => s + e.quantity, 0)} cards detected
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImport(false); setImportText("") }}
                  className="px-4 py-2 rounded-xl text-sm text-zinc-400 border border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !importText.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25 transition-colors"
                >
                  {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {importing ? "Importing…" : "Import Cards"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

