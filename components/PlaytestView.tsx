"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { X, Shuffle, RotateCcw, FlipHorizontal2, Eye, Search } from "lucide-react"
import type { CardInDeck } from "@/types"

const W = 110
const H = Math.round(W * 88 / 63)

// ── Phase step tracker ────────────────────────────────────────────────────────
type GamePhase = "untap" | "upkeep" | "draw" | "main1" | "combat" | "main2" | "end"
const PHASES: { id: GamePhase; label: string; color: string }[] = [
  { id: "untap",  label: "Untap",  color: "#6366f1" },
  { id: "upkeep", label: "Upkeep", color: "#8b5cf6" },
  { id: "draw",   label: "Draw",   color: "#3b82f6" },
  { id: "main1",  label: "Main 1", color: "#22c55e" },
  { id: "combat", label: "Combat", color: "#ef4444" },
  { id: "main2",  label: "Main 2", color: "#16a34a" },
  { id: "end",    label: "End",    color: "#f59e0b" },
]
function nextPhase(p: GamePhase): GamePhase {
  const i = PHASES.findIndex(x => x.id === p)
  return PHASES[(i + 1) % PHASES.length].id
}

// ── Counter definitions ───────────────────────────────────────────────────────
// Ordered: common ones first so context menu groups naturally
const COUNTER_DEFS: { pattern: RegExp; name: string; color: string; abbr: string }[] = [
  { pattern: /\+1\/\+1 counter/i,                    name: "+1/+1",       color: "#22c55e", abbr: "+1/+1" },
  { pattern: /-1\/-1 counter/i,                       name: "-1/-1",       color: "#ef4444", abbr: "-1/-1" },
  { pattern: /\+2\/\+2 counter/i,                     name: "+2/+2",       color: "#4ade80", abbr: "+2/+2" },
  { pattern: /charge counter/i,                       name: "charge",      color: "#60a5fa", abbr: "⚡"    },
  { pattern: /\{e\}|energy counter/i,                 name: "energy",      color: "#facc15", abbr: "⟨E⟩"  },
  { pattern: /experience counter/i,                   name: "experience",  color: "#a78bfa", abbr: "EXP"  },
  { pattern: /shield counter/i,                       name: "shield",      color: "#67e8f9", abbr: "🛡"   },
  { pattern: /oil counter/i,                          name: "oil",         color: "#86efac", abbr: "OIL"  },
  { pattern: /stun counter/i,                         name: "stun",        color: "#fb923c", abbr: "STN"  },
  { pattern: /time counter/i,                         name: "time",        color: "#c084fc", abbr: "⏱"   },
  { pattern: /spore counter/i,                        name: "spore",       color: "#a3e635", abbr: "SPR"  },
  { pattern: /ki counter/i,                           name: "ki",          color: "#f9a8d4", abbr: "KI"   },
  { pattern: /lore counter/i,                         name: "lore",        color: "#d97706", abbr: "I"    },
  { pattern: /quest counter/i,                        name: "quest",       color: "#34d399", abbr: "QST"  },
  { pattern: /age counter/i,                          name: "age",         color: "#94a3b8", abbr: "AGE"  },
  { pattern: /bounty counter/i,                       name: "bounty",      color: "#fbbf24", abbr: "$"    },
  { pattern: /level counter|level up/i,               name: "level",       color: "#818cf8", abbr: "LVL"  },
  { pattern: /training counter/i,                     name: "training",    color: "#4ade80", abbr: "TRN"  },
  { pattern: /growth counter/i,                       name: "growth",      color: "#16a34a", abbr: "GRW"  },
  { pattern: /flood counter/i,                        name: "flood",       color: "#38bdf8", abbr: "FLD"  },
  { pattern: /fade counter/i,                         name: "fade",        color: "#6b7280", abbr: "FDE"  },
  { pattern: /depletion counter/i,                    name: "depletion",   color: "#78716c", abbr: "DEP"  },
  { pattern: /verse counter/i,                        name: "verse",       color: "#f472b6", abbr: "VRS"  },
  { pattern: /luck counter/i,                         name: "luck",        color: "#fde68a", abbr: "LCK"  },
  { pattern: /study counter/i,                        name: "study",       color: "#93c5fd", abbr: "STD"  },
  { pattern: /aegis counter/i,                        name: "aegis",       color: "#7dd3fc", abbr: "AGS"  },
  { pattern: /blood counter/i,                        name: "blood",       color: "#dc2626", abbr: "BLD"  },
  { pattern: /poison counter/i,                       name: "poison",      color: "#4d7c0f", abbr: "☠"   },
  { pattern: /blaze counter/i,                        name: "blaze",       color: "#f97316", abbr: "BLZ"  },
  { pattern: /doom counter/i,                         name: "doom",        color: "#7f1d1d", abbr: "DOOM" },
  { pattern: /finality counter/i,                     name: "finality",    color: "#581c87", abbr: "FIN"  },
  { pattern: /hatchling counter/i,                    name: "hatchling",   color: "#fef08a", abbr: "HAT"  },
  { pattern: /hoofprint counter/i,                    name: "hoofprint",   color: "#d4a574", abbr: "HFP"  },
  { pattern: /ice counter/i,                          name: "ice",         color: "#bae6fd", abbr: "ICE"  },
  { pattern: /hunger counter/i,                       name: "hunger",      color: "#92400e", abbr: "HNG"  },
  { pattern: /landmark counter/i,                     name: "landmark",    color: "#a16207", abbr: "LMK"  },
  { pattern: /manifestation counter/i,                name: "manifestation",color: "#7e22ce",abbr: "MNF"  },
  { pattern: /muster counter/i,                       name: "muster",      color: "#15803d", abbr: "MST"  },
  { pattern: /page counter/i,                         name: "page",        color: "#e2e8f0", abbr: "PG"   },
  { pattern: /plague counter/i,                       name: "plague",      color: "#365314", abbr: "PLG"  },
  { pattern: /plot counter/i,                         name: "plot",        color: "#d8b4fe", abbr: "PLT"  },
  { pattern: /pressure counter/i,                     name: "pressure",    color: "#f43f5e", abbr: "PRS"  },
  { pattern: /rust counter/i,                         name: "rust",        color: "#b45309", abbr: "RST"  },
  { pattern: /slime counter/i,                        name: "slime",       color: "#84cc16", abbr: "SLM"  },
  { pattern: /slumber counter/i,                      name: "slumber",     color: "#1e40af", abbr: "SLB"  },
  { pattern: /soot counter/i,                         name: "soot",        color: "#374151", abbr: "SOT"  },
  { pattern: /storage counter/i,                      name: "storage",     color: "#6b7280", abbr: "STG"  },
  { pattern: /trap counter/i,                         name: "trap",        color: "#b91c1c", abbr: "TRP"  },
  { pattern: /wish counter/i,                         name: "wish",        color: "#fbcfe8", abbr: "WSH"  },
  { pattern: /wound counter/i,                        name: "wound",       color: "#991b1b", abbr: "WND"  },
]

interface LoyaltyAbility { label: string; delta: number }

interface ParsedAbilities {
  counterNames: string[]         // counter types detected in oracle text
  loyaltyAbilities: LoyaltyAbility[]
  isSaga: boolean
  isPlaneswalker: boolean
}

// Counters that track player state — they go on players, not permanents
const PLAYER_COUNTERS = new Set(["energy", "experience", "poison", "rad", "ticket"])

// Sentence places counter on self (this card)
function onSelf(s: string): boolean {
  return (
    /enters?(?:\s+the\s+battlefield)?\s+with[^.]*?counter/i.test(s) ||
    /\bput\b[^.]*?\bcounters?\b[^.]*?\bon\s+(?:it|this)\b/i.test(s) ||
    /\b(?:it|this\s+\w+)\s+(?:gets?|gains?)\s+[^.]*?\bcounters?\b/i.test(s)
  )
}

// Sentence places counter on another permanent or player (not self)
function onOther(s: string): boolean {
  return /\bput\b[^.]*?\bcounters?\b[^.]*?\bon\s+(?:target\b|each\b|another\b|an?\s+opponent|players?)\b/i.test(s)
}

function parseCardAbilities(oracleText: string, typeLine: string): ParsedAbilities {
  const text = oracleText ?? ""
  const type = typeLine ?? ""
  const isPlaneswalker = /planeswalker/i.test(type)
  const isSaga = /saga/i.test(type)

  const counterNames: string[] = []
  for (const def of COUNTER_DEFS) {
    if (!def.pattern.test(text)) continue
    // Player counters never go on permanents
    if (PLAYER_COUNTERS.has(def.name)) continue

    // Analyse each sentence that mentions this counter type
    const sentences = text.split(/\. |\n/).filter(s => def.pattern.test(s))
    // Only consider sentences that actually place a counter (contain "put" or a self-placement verb)
    const placementSentences = sentences.filter(s => /\bput\b[^.]*?\bcounters?\b/i.test(s) || onSelf(s))

    if (placementSentences.some(s => onSelf(s))) {
      // Explicitly placed on self — include
      counterNames.push(def.name)
    } else if (placementSentences.length > 0 && placementSentences.every(s => onOther(s))) {
      // Every placement puts the counter on another permanent/player — skip
      continue
    } else {
      // Mentioned in a triggered/static context without clear placement target (level up,
      // keyword reminder, proliferate, etc.) — include so the player can track it
      counterNames.push(def.name)
    }
  }

  if (isSaga && !counterNames.includes("lore")) counterNames.unshift("lore")
  if (isPlaneswalker && !counterNames.includes("loyalty")) counterNames.unshift("loyalty" as never)

  // Parse planeswalker loyalty ability costs: lines like "+2: …", "-3: …", "0: …"
  const loyaltyAbilities: LoyaltyAbility[] = []
  if (isPlaneswalker) {
    for (const line of text.split(/\n/)) {
      const m = line.trim().match(/^([+\-−]?\d+)\s*:(.+)/)
      if (!m) continue
      const delta = parseInt(m[1].replace("−", "-"))
      if (isNaN(delta)) continue
      const preview = m[2].trim().replace(/\{[^}]+\}/g, "").trim().slice(0, 48)
      loyaltyAbilities.push({
        delta,
        label: `${delta > 0 ? `+${delta}` : delta}: ${preview}${preview.length >= 48 ? "…" : ""}`,
      })
    }
  }

  return { counterNames, loyaltyAbilities, isSaga, isPlaneswalker }
}

function counterColor(name: string): string {
  return COUNTER_DEFS.find(d => d.name === name)?.color ?? "#6b7280"
}

function counterAbbr(name: string): string {
  return COUNTER_DEFS.find(d => d.name === name)?.abbr ?? name.slice(0, 3).toUpperCase()
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface BFCard {
  id: string
  card: CardInDeck
  tapped: boolean
  flipped: boolean
  counters: Record<string, number>
  x: number
  y: number
}

interface Opponent {
  name: string
  life: number
  cmdDamage: Record<string, number>
}

// "self" = you, number = opponent index, null = nobody
type StatusHolder = "self" | number | null

interface PS {
  library: CardInDeck[]
  hand: CardInDeck[]
  battlefield: BFCard[]
  graveyard: CardInDeck[]
  exile: CardInDeck[]
  commandZone: CardInDeck[]
  life: number
  opponents: Opponent[]
  turn: number
  mulligans: number
  mulliganPhase: "playing" | "bottoming"
  gamePhase: GamePhase
  bottomCount: number
  bottomSelected: Set<number>
  playerCounters: Record<string, number>
  monarch: StatusHolder
  initiative: StatusHolder
  cmdCastCount: Record<string, number>
}

interface BFCtx { id: string; x: number; y: number }
interface HandCtx { idx: number; x: number; y: number }
interface HandDrag { idx: number; card: CardInDeck; x: number; y: number }
interface CmdDrag { card: CardInDeck; x: number; y: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function expand(cards: CardInDeck[]): CardInDeck[] {
  return cards.flatMap((c) => Array.from({ length: c.quantity }, () => ({ ...c })))
}

function makeBFC(card: CardInDeck, x: number, y: number, tag = ""): BFCard {
  const isPlaneswalker = /planeswalker/i.test(card.typeLine)
  const counters: Record<string, number> = isPlaneswalker && card.loyalty ? { loyalty: parseInt(card.loyalty) } : {}
  return { id: `${card.scryfallId}-${tag}${Date.now()}-${Math.random()}`, card, tapped: false, flipped: false, counters, x, y }
}

function gridPos(n: number) {
  return { x: 16 + (n % 7) * (W + 10), y: 16 + Math.floor(n / 7) * (H + 10) }
}

// Find a free position on the battlefield starting from center, spiraling outward.
// `placed` is a list of positions already reserved in this batch (for multi-token creates).
function findFreePos(
  existing: { x: number; y: number }[],
  placed: { x: number; y: number }[],
  bfW: number,
  bfH: number
): { x: number; y: number } {
  const PAD = 10
  const STEP_X = W + PAD
  const STEP_Y = H + PAD
  const cx = Math.max(0, Math.round(bfW / 2 - W / 2))
  const cy = Math.max(0, Math.round(bfH / 2 - H / 2))
  const all = [...existing, ...placed]
  const overlaps = (x: number, y: number) =>
    all.some(e => Math.abs(e.x - x) < W + PAD && Math.abs(e.y - y) < H + PAD)
  if (!overlaps(cx, cy)) return { x: cx, y: cy }
  for (let ring = 1; ring <= 12; ring++) {
    for (let col = -ring; col <= ring; col++) {
      for (let row = -ring; row <= ring; row++) {
        if (Math.abs(col) !== ring && Math.abs(row) !== ring) continue
        const x = Math.max(0, cx + col * STEP_X)
        const y = Math.max(0, cy + row * STEP_Y)
        if (!overlaps(x, y)) return { x, y }
      }
    }
  }
  return { x: cx, y: cy }
}

// Token color helpers
const TOKEN_COLOR_MAP: Record<string, string> = { W: "#c8b860", U: "#3a6eb5", B: "#7a3aaa", R: "#b54020", G: "#2a8a3a" }
const TOKEN_BORDER_MAP: Record<string, string> = { W: "rgba(210,190,100,0.55)", U: "rgba(60,110,200,0.55)", B: "rgba(130,60,190,0.55)", R: "rgba(200,70,40,0.55)", G: "rgba(50,170,60,0.55)" }

function tokenBg(colors: string[]): string {
  if (colors.length === 0) return "linear-gradient(145deg,#2e2e3e,#1a1a2a)"
  if (colors.length >= 2) return "linear-gradient(145deg,#4a3a10,#2a2008)"
  const c = colors[0]
  return c === "W" ? "linear-gradient(145deg,#7a6830,#504520)" : c === "U" ? "linear-gradient(145deg,#1a3a6e,#0d2040)" : c === "B" ? "linear-gradient(145deg,#2a1040,#150820)" : c === "R" ? "linear-gradient(145deg,#6e1a0a,#400d05)" : "linear-gradient(145deg,#1a4a1a,#0d2a0d)"
}
function tokenBorderColor(colors: string[]): string {
  if (colors.length === 0) return "rgba(110,110,130,0.4)"
  if (colors.length >= 2) return "rgba(200,170,70,0.5)"
  return TOKEN_BORDER_MAP[colors[0]] ?? "rgba(110,110,130,0.4)"
}

function newGame(cards: CardInDeck[]): PS {
  const commanders = cards.filter((c) => c.isCommander)
  // Companion is outside the game — not in library, tracked separately in command zone area
  const companion = cards.filter((c) => c.isCompanion)
  const lib = shuffle(expand(cards.filter((c) => !c.isCommander && !c.isCompanion)))
  const hand = lib.splice(0, 7)
  return {
    library: lib, hand,
    battlefield: [], graveyard: [], exile: [],
    commandZone: [...commanders, ...companion],
    life: 40,
    opponents: [
      { name: "Player 2", life: 40, cmdDamage: {} },
      { name: "Player 3", life: 40, cmdDamage: {} },
      { name: "Player 4", life: 40, cmdDamage: {} },
    ],
    turn: 1, mulligans: 0,
    mulliganPhase: "playing", gamePhase: "main1",
    bottomCount: 0, bottomSelected: new Set(),
    playerCounters: {},
    monarch: null, initiative: null,
    cmdCastCount: {},
  }
}

const CARD_BACK_URLS = [
  "https://cards.scryfall.io/normal/back/0/0/00000000-0000-0000-0000-000000000000.jpg",
  "https://cards.scryfall.io/normal/back/59/7b/597b79b3-7d77-4261-871a-60dd17403388.jpg",
  "https://c2.scryfall.com/file/scryfall-card-backs/normal/59/597b79b3-7d77-4261-871a-60dd17403388.jpg",
]

// ─────────────────────────────────────────────────────────────────────────────
export function PlaytestView({ cards, onClose }: { cards: CardInDeck[]; onClose: () => void }) {
  const [ps, setPS] = useState<PS>(() => newGame(cards))
  const [showGY, setShowGY] = useState(false)
  const [showExile, setShowExile] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showTokenCreator, setShowTokenCreator] = useState(false)
  const [scryN, setScryN] = useState<number | null>(null)
  const [millN, setMillN] = useState<number | null>(null)
  const [customCounter, setCustomCounter] = useState<{ bfcId: string } | null>(null)
  const [showReveal, setShowReveal] = useState(false)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const [bfCtx, setBfCtx] = useState<BFCtx | null>(null)
  const [handCtx, setHandCtx] = useState<HandCtx | null>(null)
  const [handFlipped, setHandFlipped] = useState<Set<number>>(new Set())
  const [handDrag, setHandDrag] = useState<HandDrag | null>(null)
  const [cmdDrag, setCmdDrag] = useState<CmdDrag | null>(null)
  const [dropTarget, setDropTarget] = useState<"battlefield" | "graveyard" | "exile" | "hand" | null>(null)

  const bfRef = useRef<HTMLDivElement>(null)
  const bfSizeRef = useRef({ w: 0, h: 0 })
  const gyRef = useRef<HTMLButtonElement>(null)
  const exileRef = useRef<HTMLButtonElement>(null)
  const handZoneRef = useRef<HTMLDivElement>(null)
  const bfDrag = useRef<{ id: string; sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null)
  const bfClickBlocked = useRef(false)
  // Fixed list of all commander/companion cards for this game — used to render ghost placeholders
  const cmdCards = useRef<CardInDeck[]>(cards.filter(c => c.isCommander || c.isCompanion))

  const upd = useCallback((fn: (s: PS) => PS) => setPS(fn), [])

  // ── Battlefield resize → scale card positions proportionally ─────────────
  useEffect(() => {
    if (!bfRef.current) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      const { w: oldW, h: oldH } = bfSizeRef.current
      if (oldW > 0 && oldH > 0 && (Math.abs(oldW - width) > 1 || Math.abs(oldH - height) > 1)) {
        const sx = width / oldW
        const sy = height / oldH
        setPS(s => ({
          ...s,
          battlefield: s.battlefield.map(c => ({ ...c, x: c.x * sx, y: c.y * sy })),
        }))
      }
      bfSizeRef.current = { w: width, h: height }
    })
    obs.observe(bfRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Escape") {
        setZoomed(null); setBfCtx(null); setHandCtx(null)
        setShowGY(false); setShowExile(false); setShowLibrary(false)
        return
      }
      if (e.key === "d" || e.key === "D") {
        setPS(s => s.library.length === 0 ? s : { ...s, library: s.library.slice(1), hand: [...s.hand, s.library[0]] })
      }
      if (e.key === "n" || e.key === "N") {
        setPS(s => {
          const next = nextPhase(s.gamePhase)
          if (next === "untap") return { ...s, gamePhase: next, battlefield: s.battlefield.map(c => ({ ...c, tapped: false })), turn: s.turn + 1 }
          return { ...s, gamePhase: next }
        })
      }
      if (e.key === "u" || e.key === "U") {
        setPS(s => ({ ...s, battlefield: s.battlefield.map(c => ({ ...c, tapped: false })) }))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // ── Game actions ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setPS(newGame(cards)); setHandDrag(null); setHandFlipped(new Set())
    setBfCtx(null); setHandCtx(null)
  }, [cards])

  const drawCard = useCallback(() =>
    upd(s => s.library.length === 0 ? s : { ...s, library: s.library.slice(1), hand: [...s.hand, s.library[0]] }), [upd])

  const mulligan = useCallback(() =>
    upd(s => {
      if (s.mulliganPhase !== "playing") return s
      const n = s.mulligans + 1
      const combined = shuffle([...s.hand, ...s.library])
      const hand = combined.splice(0, 7)
      return { ...s, library: combined, hand, mulligans: n, mulliganPhase: "bottoming", bottomCount: Math.min(n, hand.length), bottomSelected: new Set() }
    }), [upd])

  const toggleBottom = useCallback((idx: number) =>
    upd(s => {
      if (s.mulliganPhase !== "bottoming") return s
      const sel = new Set(s.bottomSelected)
      sel.has(idx) ? sel.delete(idx) : sel.size < s.bottomCount && sel.add(idx)
      return { ...s, bottomSelected: sel }
    }), [upd])

  const confirmBottom = useCallback(() =>
    upd(s => {
      if (s.mulliganPhase !== "bottoming" || s.bottomSelected.size !== s.bottomCount) return s
      const bottomed: CardInDeck[] = [], kept: CardInDeck[] = []
      s.hand.forEach((c, i) => (s.bottomSelected.has(i) ? bottomed : kept).push(c))
      return { ...s, hand: kept, library: [...s.library, ...shuffle(bottomed)], mulliganPhase: "playing", bottomSelected: new Set() }
    }), [upd])

  const advancePhase = useCallback(() =>
    upd(s => {
      const next = nextPhase(s.gamePhase)
      if (next === "untap") return { ...s, gamePhase: next, battlefield: s.battlefield.map(c => ({ ...c, tapped: false })), turn: s.turn + 1 }
      return { ...s, gamePhase: next }
    }), [upd])

  const untapAll = useCallback(() =>
    upd(s => ({ ...s, battlefield: s.battlefield.map(c => ({ ...c, tapped: false })) })), [upd])

  const adjustLife = useCallback((d: number) => upd(s => ({ ...s, life: s.life + d })), [upd])

  const adjustOppLife = useCallback((idx: number, d: number) =>
    upd(s => ({
      ...s,
      opponents: s.opponents.map((o, i) => i === idx ? { ...o, life: o.life + d } : o),
    })), [upd])

  const adjustCmdDamage = useCallback((oppIdx: number, cmdName: string, d: number) =>
    upd(s => ({
      ...s,
      opponents: s.opponents.map((o, i) => {
        if (i !== oppIdx) return o
        const prev = o.cmdDamage[cmdName] ?? 0
        const next = Math.max(0, prev + d)
        const cmdDamage = { ...o.cmdDamage, [cmdName]: next }
        return { ...o, life: o.life - d, cmdDamage }
      }),
    })), [upd])

  const renameOpponent = useCallback((idx: number, name: string) =>
    upd(s => ({
      ...s,
      opponents: s.opponents.map((o, i) => i === idx ? { ...o, name } : o),
    })), [upd])

  const setMonarch = useCallback((h: StatusHolder) => upd(s => ({ ...s, monarch: h })), [upd])
  const setInitiative = useCallback((h: StatusHolder) => upd(s => ({ ...s, initiative: h })), [upd])

  const adjustCmdCast = useCallback((name: string, d: number) =>
    upd(s => {
      const next = Math.max(0, (s.cmdCastCount[name] ?? 0) + d)
      const cmdCastCount = { ...s.cmdCastCount, [name]: next }
      if (next === 0) delete cmdCastCount[name]
      return { ...s, cmdCastCount }
    }), [upd])
  const adjustPlayerCounter = useCallback((name: string, delta: number) =>
    upd(s => {
      const next = Math.max(0, (s.playerCounters[name] ?? 0) + delta)
      const counters = { ...s.playerCounters, [name]: next }
      if (next === 0) delete counters[name]
      return { ...s, playerCounters: counters }
    }), [upd])

  const playFromHandAt = useCallback((idx: number, x: number, y: number) =>
    upd(s => {
      const card = s.hand[idx]
      if (!card) return s
      return { ...s, hand: s.hand.filter((_, i) => i !== idx), battlefield: [...s.battlefield, makeBFC(card, x, y, "play")] }
    }), [upd])

  const returnToCommandZone = useCallback((bfcId: string) =>
    upd(s => {
      const bfc = s.battlefield.find(b => b.id === bfcId)
      if (!bfc) return s
      return {
        ...s,
        battlefield: s.battlefield.filter(b => b.id !== bfcId),
        commandZone: [...s.commandZone, bfc.card],
      }
    }), [upd])

  const tap = useCallback((id: string) =>
    upd(s => ({ ...s, battlefield: s.battlefield.map(c => c.id === id ? { ...c, tapped: !c.tapped } : c) })), [upd])

  const flipBF = useCallback((id: string) =>
    upd(s => ({ ...s, battlefield: s.battlefield.map(c => c.id === id ? { ...c, flipped: !c.flipped } : c) })), [upd])

  const addCounter = useCallback((id: string, counterName: string, delta: number) =>
    upd(s => ({
      ...s,
      battlefield: s.battlefield.map(c => {
        if (c.id !== id) return c
        const prev = c.counters[counterName] ?? 0
        const next = Math.max(0, prev + delta)
        const counters = { ...c.counters, [counterName]: next }
        if (next === 0) delete counters[counterName]
        return { ...c, counters }
      }),
    })), [upd])

  const copyToBF = useCallback((id: string) =>
    upd(s => {
      const src = s.battlefield.find(c => c.id === id)
      if (!src) return s
      return { ...s, battlefield: [...s.battlefield, makeBFC(src.card, src.x + 20, src.y + 20, "copy")] }
    }), [upd])

  const toGY = useCallback((id: string) =>
    upd(s => {
      const bf = s.battlefield.find(c => c.id === id)
      if (!bf) return s
      const isToken = bf.card.scryfallId.startsWith("token-")
      return {
        ...s,
        battlefield: s.battlefield.filter(c => c.id !== id),
        graveyard: isToken ? s.graveyard : [...s.graveyard, bf.card],
      }
    }), [upd])

  const toExile = useCallback((id: string) =>
    upd(s => {
      const bf = s.battlefield.find(c => c.id === id)
      if (!bf) return s
      const isToken = bf.card.scryfallId.startsWith("token-")
      return {
        ...s,
        battlefield: s.battlefield.filter(c => c.id !== id),
        exile: isToken ? s.exile : [...s.exile, bf.card],
      }
    }), [upd])

  const toTopOfLib = useCallback((id: string) =>
    upd(s => {
      const bf = s.battlefield.find(c => c.id === id)
      return bf ? { ...s, battlefield: s.battlefield.filter(c => c.id !== id), library: [bf.card, ...s.library] } : s
    }), [upd])

  const bounce = useCallback((id: string) =>
    upd(s => {
      const bf = s.battlefield.find(c => c.id === id)
      return bf ? { ...s, battlefield: s.battlefield.filter(c => c.id !== id), hand: [...s.hand, bf.card] } : s
    }), [upd])

  const handToGY = useCallback((idx: number) =>
    upd(s => ({ ...s, hand: s.hand.filter((_, i) => i !== idx), graveyard: [...s.graveyard, s.hand[idx]] })), [upd])

  const handToExile = useCallback((idx: number) =>
    upd(s => ({ ...s, hand: s.hand.filter((_, i) => i !== idx), exile: [...s.exile, s.hand[idx]] })), [upd])

  const handToTop = useCallback((idx: number) =>
    upd(s => ({ ...s, hand: s.hand.filter((_, i) => i !== idx), library: [s.hand[idx], ...s.library] })), [upd])

  const handToBottom = useCallback((idx: number) =>
    upd(s => ({ ...s, hand: s.hand.filter((_, i) => i !== idx), library: [...s.library, s.hand[idx]] })), [upd])

  const gyToHand    = useCallback((idx: number) => upd(s => ({ ...s, graveyard: s.graveyard.filter((_, i) => i !== idx), hand: [...s.hand, s.graveyard[idx]] })), [upd])
  const gyToBF      = useCallback((idx: number) => upd(s => { const card = s.graveyard[idx]; const p = gridPos(s.battlefield.length); return { ...s, graveyard: s.graveyard.filter((_, i) => i !== idx), battlefield: [...s.battlefield, makeBFC(card, p.x, p.y, "gy")] } }), [upd])
  const gyToExile   = useCallback((idx: number) => upd(s => ({ ...s, graveyard: s.graveyard.filter((_, i) => i !== idx), exile: [...s.exile, s.graveyard[idx]] })), [upd])
  const gyToTopLib  = useCallback((idx: number) => upd(s => ({ ...s, graveyard: s.graveyard.filter((_, i) => i !== idx), library: [s.graveyard[idx], ...s.library] })), [upd])

  const exileToHand   = useCallback((idx: number) => upd(s => ({ ...s, exile: s.exile.filter((_, i) => i !== idx), hand: [...s.hand, s.exile[idx]] })), [upd])
  const exileToBF     = useCallback((idx: number) => upd(s => { const card = s.exile[idx]; const p = gridPos(s.battlefield.length); return { ...s, exile: s.exile.filter((_, i) => i !== idx), battlefield: [...s.battlefield, makeBFC(card, p.x, p.y, "exile")] } }), [upd])
  const exileToGY     = useCallback((idx: number) => upd(s => ({ ...s, exile: s.exile.filter((_, i) => i !== idx), graveyard: [...s.graveyard, s.exile[idx]] })), [upd])
  const exileToTopLib = useCallback((idx: number) => upd(s => ({ ...s, exile: s.exile.filter((_, i) => i !== idx), library: [s.exile[idx], ...s.library] })), [upd])

  const createToken = useCallback((name: string, colors: string[], typeLine: string, qty: number) => {
    const rect = bfRef.current?.getBoundingClientRect()
    const bfW = rect?.width ?? 1200
    const bfH = rect?.height ?? 600
    upd(s => {
      const placed: { x: number; y: number }[] = []
      const newBFCs = Array.from({ length: qty }, (_, i) => {
        const card: CardInDeck = {
          scryfallId: `token-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          name, quantity: 1, cmc: 0, typeLine, colorIdentity: colors,
          manaCost: "", prices: {}, imageUri: "", oracleText: "", isCommander: false,
        }
        const pos = findFreePos(s.battlefield, placed, bfW, bfH)
        placed.push(pos)
        return makeBFC(card, pos.x, pos.y, "token")
      })
      return { ...s, battlefield: [...s.battlefield, ...newBFCs] }
    })
  }, [upd])

  const drawSpecific = useCallback((idx: number) =>
    upd(s => {
      if (idx >= s.library.length) return s
      const card = s.library[idx]
      const lib = [...s.library]
      lib.splice(idx, 1)
      return { ...s, library: lib, hand: [...s.hand, card] }
    }), [upd])

  const shuffleLibrary = useCallback(() =>
    upd(s => ({ ...s, library: shuffle(s.library) })), [upd])

  const mill = useCallback((n: number) =>
    upd(s => {
      const milled = s.library.slice(0, n)
      return { ...s, library: s.library.slice(n), graveyard: [...s.graveyard, ...milled] }
    }), [upd])

  const scryKeepTop = useCallback((topCards: CardInDeck[], bottomCards: CardInDeck[], gyCards: CardInDeck[]) =>
    upd(s => {
      const n = topCards.length + bottomCards.length + gyCards.length
      const rest = s.library.slice(n)
      return {
        ...s,
        library: [...topCards, ...rest, ...bottomCards],
        graveyard: [...s.graveyard, ...gyCards],
      }
    }), [upd])

  const libTopToGY     = useCallback(() => upd(s => s.library.length === 0 ? s : { ...s, library: s.library.slice(1), graveyard: [...s.graveyard, s.library[0]] }), [upd])
  const libTopToBottom = useCallback(() => upd(s => s.library.length === 0 ? s : { ...s, library: [...s.library.slice(1), s.library[0]] }), [upd])
  const libTopToExile  = useCallback(() => upd(s => s.library.length === 0 ? s : { ...s, library: s.library.slice(1), exile: [...s.exile, s.library[0]] }), [upd])

  const proliferate = useCallback(() =>
    upd(s => ({
      ...s,
      battlefield: s.battlefield.map(bfc => {
        const active = Object.entries(bfc.counters).filter(([, v]) => v > 0)
        if (active.length === 0) return bfc
        const counters = { ...bfc.counters }
        for (const [name] of active) counters[name]++
        return { ...bfc, counters }
      }),
      playerCounters: Object.fromEntries(
        Object.entries(s.playerCounters).map(([k, v]) => [k, v + 1])
      ),
    })), [upd])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onGlobalMouseMove = useCallback((e: React.MouseEvent) => {
    if (bfDrag.current) {
      const dx = e.clientX - bfDrag.current.sx
      const dy = e.clientY - bfDrag.current.sy
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { bfDrag.current.moved = true; bfClickBlocked.current = true }
      const { id, cx, cy } = bfDrag.current
      const bfRect = bfRef.current?.getBoundingClientRect()
      const maxX = bfRect ? bfRect.width  - W : Infinity
      const maxY = bfRect ? bfRect.height - H : Infinity
      setPS(s => ({ ...s, battlefield: s.battlefield.map(c => c.id === id
        ? { ...c, x: Math.max(0, Math.min(cx + dx, maxX)), y: Math.max(0, Math.min(cy + dy, maxY)) }
        : c) }))
      if (bfDrag.current.moved) {
        const hz = handZoneRef.current?.getBoundingClientRect()
        const gy = gyRef.current?.getBoundingClientRect()
        const ex = exileRef.current?.getBoundingClientRect()
        const cx = e.clientX, cy = e.clientY
        const over = (r: DOMRect) => cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
        if (hz && over(hz)) setDropTarget("hand")
        else if (gy && over(gy)) setDropTarget("graveyard")
        else if (ex && over(ex)) setDropTarget("exile")
        else setDropTarget(null)
      }
    }
    if (handDrag || cmdDrag) {
      if (handDrag) setHandDrag(d => d ? { ...d, x: e.clientX, y: e.clientY } : null)
      if (cmdDrag) setCmdDrag(d => d ? { ...d, x: e.clientX, y: e.clientY } : null)
      const bf = bfRef.current?.getBoundingClientRect()
      const gy = gyRef.current?.getBoundingClientRect()
      const ex = exileRef.current?.getBoundingClientRect()
      if (gy && e.clientX >= gy.left && e.clientX <= gy.right && e.clientY >= gy.top && e.clientY <= gy.bottom) setDropTarget("graveyard")
      else if (ex && e.clientX >= ex.left && e.clientX <= ex.right && e.clientY >= ex.top && e.clientY <= ex.bottom) setDropTarget("exile")
      else if (bf && e.clientX >= bf.left && e.clientX <= bf.right && e.clientY >= bf.top && e.clientY <= bf.bottom) setDropTarget("battlefield")
      else setDropTarget(null)
    }
  }, [handDrag, cmdDrag])

  const onGlobalMouseUp = useCallback((e: React.MouseEvent) => {
    if (bfDrag.current?.moved) {
      const id = bfDrag.current.id
      const cx = e.clientX, cy = e.clientY
      const over = (r: DOMRect) => cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
      const hz = handZoneRef.current?.getBoundingClientRect()
      const gy = gyRef.current?.getBoundingClientRect()
      const ex = exileRef.current?.getBoundingClientRect()
      if (hz && over(hz)) bounce(id)
      else if (gy && over(gy)) toGY(id)
      else if (ex && over(ex)) toExile(id)
    }
    bfDrag.current = null
    setDropTarget(null)
    if (handDrag) {
      const gy = gyRef.current?.getBoundingClientRect()
      const ex = exileRef.current?.getBoundingClientRect()
      const bf = bfRef.current?.getBoundingClientRect()
      if (gy && e.clientX >= gy.left && e.clientX <= gy.right && e.clientY >= gy.top && e.clientY <= gy.bottom) {
        handToGY(handDrag.idx)
      } else if (ex && e.clientX >= ex.left && e.clientX <= ex.right && e.clientY >= ex.top && e.clientY <= ex.bottom) {
        handToExile(handDrag.idx)
      } else if (bf && e.clientX >= bf.left && e.clientX <= bf.right && e.clientY >= bf.top && e.clientY <= bf.bottom) {
        playFromHandAt(handDrag.idx, Math.max(0, e.clientX - bf.left - W / 2), Math.max(0, e.clientY - bf.top - H / 2))
      }
      setHandDrag(null)
    }
    if (cmdDrag) {
      const bf = bfRef.current?.getBoundingClientRect()
      if (bf && e.clientX >= bf.left && e.clientX <= bf.right && e.clientY >= bf.top && e.clientY <= bf.bottom) {
        const card = cmdDrag.card
        const x = Math.max(0, e.clientX - bf.left - W / 2)
        const y = Math.max(0, e.clientY - bf.top - H / 2)
        if (card.isCompanion) {
          upd(s => ({ ...s, commandZone: s.commandZone.filter(c => c.scryfallId !== card.scryfallId), hand: [...s.hand, card] }))
        } else {
          upd(s => ({
            ...s,
            commandZone: s.commandZone.filter(c => c.scryfallId !== card.scryfallId),
            battlefield: [...s.battlefield, makeBFC(card, x, y, "cmd")],
            cmdCastCount: { ...s.cmdCastCount, [card.name]: (s.cmdCastCount[card.name] ?? 0) + 1 },
          }))
        }
      }
      setCmdDrag(null)
    }
  }, [handDrag, cmdDrag, handToGY, handToExile, playFromHandAt, bounce, toGY, toExile, upd])

  const closeAll = () => { setBfCtx(null); setHandCtx(null) }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#070710", cursor: (handDrag || cmdDrag) ? "grabbing" : "default" }}
      onMouseMove={onGlobalMouseMove}
      onMouseUp={onGlobalMouseUp}
      onClick={closeAll}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 select-none"
        style={{ background: "rgba(6,7,30,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: 44 }}>

        <button onClick={reset}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          <Shuffle className="w-3.5 h-3.5" /> New Game
        </button>

        <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

        {ps.mulliganPhase === "playing" ? (
          <button onClick={mulligan}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
            <RotateCcw className="w-3 h-3" />
            Mulligan{ps.mulligans > 0 ? ` (${ps.mulligans})` : ""}
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold text-amber-400">
              Select {ps.bottomCount - ps.bottomSelected.size} to bottom
            </span>
            <button onClick={confirmBottom} disabled={ps.bottomSelected.size !== ps.bottomCount}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-40 transition-colors">
              Confirm
            </button>
          </div>
        )}

        <button onClick={drawCard}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          Draw
        </button>

        <button onClick={untapAll}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          Untap All
        </button>

        <button onClick={(e) => { e.stopPropagation(); setShowTokenCreator(true) }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          + Token
        </button>

        <button onClick={(e) => { e.stopPropagation(); setScryN(1) }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          Scry
        </button>

        <button onClick={(e) => { e.stopPropagation(); setMillN(1) }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          Mill
        </button>

        <button onClick={(e) => { e.stopPropagation(); shuffleLibrary() }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          Shuffle
        </button>

        <button onClick={(e) => { e.stopPropagation(); proliferate() }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors flex-shrink-0">
          Proliferate
        </button>

        <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* Phase tracker */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {PHASES.map(phase => {
            const active = ps.gamePhase === phase.id
            return (
              <button key={phase.id}
                onClick={(e) => { e.stopPropagation(); upd(s => ({ ...s, gamePhase: phase.id })) }}
                className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                style={{
                  background: active ? `${phase.color}22` : "transparent",
                  color: active ? phase.color : "rgba(255,255,255,0.25)",
                  border: `1px solid ${active ? phase.color : "transparent"}`,
                }}>
                {phase.label}
              </button>
            )
          })}
          <button onClick={(e) => { e.stopPropagation(); advancePhase() }}
            className="ml-1 w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] text-sm font-bold transition-colors"
            title="Next phase (N)">→</button>
        </div>

        <span className="text-[10px] text-zinc-700 font-bold flex-shrink-0">T{ps.turn}</span>

        <div className="flex-1" />

        {/* Your life */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => adjustLife(-1)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.08] font-bold text-base transition-colors">−</button>
          <span className="text-xl font-bold tabular-nums w-10 text-center"
            style={{ color: ps.life <= 5 ? "#ef4444" : ps.life <= 10 ? "#f97316" : "#ffffff" }}>{ps.life}</span>
          <button onClick={() => adjustLife(+1)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-green-400 hover:bg-white/[0.08] font-bold text-base transition-colors">+</button>
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Life</span>
        </div>

        <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.07] transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Battlefield ────────────────────────────────────────────────────── */}
      <div
        ref={bfRef}
        className="flex-1 relative overflow-hidden"
        style={{
          background: "#06070e",
          backgroundImage: [
            "radial-gradient(ellipse at 30% 40%, rgba(12,14,32,0.9) 0%, transparent 60%)",
            "radial-gradient(ellipse at 70% 60%, rgba(10,11,26,0.7) 0%, transparent 55%)",
          ].join(", "),
          outline: dropTarget === "battlefield" ? "2px solid rgba(99,179,237,0.45)" : "none",
          transition: "outline 0.1s",
        }}
      >
        {/* ── Playmat ───────────────────────────────────────────────────────── */}
        {/* 24×13.5 inch real playmat ratio ≈ 16:9. Pinned to center so all
            calc() offsets below stay in sync without JS measurement. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width:  "min(95%, 1230px)",
            height: "min(90%, 690px)",
            borderRadius: 18,
            background: "linear-gradient(150deg, #0d1028 0%, #090b20 50%, #0b0d24 100%)",
            border: "1px solid rgba(99,102,241,0.2)",
            boxShadow: [
              "0 20px 80px rgba(0,0,0,0.85)",
              "0 2px 6px rgba(0,0,0,0.9)",
              "inset 0 1px 0 rgba(255,255,255,0.04)",
              "inset 0 0 60px rgba(0,0,0,0.18)",
            ].join(", "),
            zIndex: 0,
          }}
        />

        {/* Empty hint */}
        {ps.battlefield.length === 0 && ps.commandZone.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
            <p className="text-zinc-800 text-sm select-none">Drag cards here from your hand</p>
            <p className="text-zinc-900 text-[10px] select-none">D = Draw · N = Next Phase · U = Untap · Esc = Close modals</p>
          </div>
        )}

        {/* Command zone */}
        {cmdCards.current.length > 0 && (
          <div className="absolute flex flex-col gap-1.5" style={{ top: "calc(50% - min(45%, 345px) + 14px)", left: "calc(50% - min(47.5%, 615px) + 14px)", zIndex: 10 }}>
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500/50 pl-0.5">Command Zone</span>
            <div className="flex gap-2">
              {cmdCards.current.map((cmd, i) => {
                const inZone = ps.commandZone.some(c => c.scryfallId === cmd.scryfallId)
                const isCompanion = !!cmd.isCompanion
                const borderColor = isCompanion ? "rgba(129,140,248,0.4)" : "rgba(245,158,11,0.4)"
                if (!inZone) {
                  // Ghost placeholder — commander is elsewhere (battlefield/hand)
                  return (
                    <div key={i} className="rounded-lg" style={{
                      width: W, height: H,
                      border: `1.5px dashed ${borderColor}`,
                      background: "rgba(0,0,0,0.25)",
                    }} />
                  )
                }
                return (
                  <CmdZoneCard key={i} cmd={cmd}
                    castCount={ps.cmdCastCount[cmd.name] ?? 0}
                    onCastCountChange={(d) => adjustCmdCast(cmd.name, d)}
                    onDragStart={(e) => { e.preventDefault(); setCmdDrag({ card: cmd, x: e.clientX, y: e.clientY }) }} />
                )
              })}
            </div>
          </div>
        )}

        {/* Above playmat, between mat and nav bar — opponents + player toolbox */}
        <div
          className="absolute flex flex-col justify-center gap-1.5"
          style={{
            top: 0,
            bottom: "calc(50% + min(45%, 345px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
          onClick={e => e.stopPropagation()}
        >
          <OpponentsPanel
            opponents={ps.opponents}
            commanders={cmdCards.current.filter(c => c.isCommander)}
            onAdjustLife={adjustOppLife}
            onAdjustCmdDamage={adjustCmdDamage}
            onRename={renameOpponent}
          />
          <PlayerSidePanel
            playerCounters={ps.playerCounters}
            opponents={ps.opponents}
            monarch={ps.monarch}
            initiative={ps.initiative}
            onAdjustCounter={adjustPlayerCounter}
            onSetMonarch={setMonarch}
            onSetInitiative={setInitiative}
          />
        </div>

        {/* Battlefield permanents */}
        {ps.battlefield.map((bfc) => {
          const uri = bfc.flipped && bfc.card.imageUriBack ? bfc.card.imageUriBack : bfc.card.imageUri
          const isDragging = bfDrag.current?.id === bfc.id
          return (
            <div key={bfc.id}
              className="absolute select-none group/bfc"
              style={{
                left: bfc.x, top: bfc.y, width: W, height: H,
                transform: bfc.tapped ? "rotate(90deg)" : "none",
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.18s ease",
                cursor: isDragging ? "grabbing" : "grab",
                zIndex: isDragging ? 100 : 1,
                filter: bfc.tapped ? "brightness(0.8) saturate(0.8)" : "none",
              }}
              onMouseDown={(e) => {
                if (e.button !== 0) return
                e.stopPropagation()
                bfDrag.current = { id: bfc.id, sx: e.clientX, sy: e.clientY, cx: bfc.x, cy: bfc.y, moved: false }
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (bfClickBlocked.current) { bfClickBlocked.current = false; return }
                tap(bfc.id)
              }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setBfCtx({ id: bfc.id, x: e.clientX, y: e.clientY }) }}
            >
              {uri ? (
                <img src={uri} alt={bfc.card.name} draggable={false}
                  className="w-full h-full rounded-lg shadow-xl select-none"
                  style={{ objectFit: "cover", objectPosition: "top" }} />
              ) : (
                <div className="w-full h-full rounded-lg flex flex-col items-center justify-center p-2 text-center select-none"
                  style={{ background: tokenBg(bfc.card.colorIdentity), border: `1.5px solid ${tokenBorderColor(bfc.card.colorIdentity)}` }}>
                  <span className="text-[10px] font-bold text-white/90 leading-snug">{bfc.card.name}</span>
                  {bfc.card.typeLine && (
                    <span className="text-[8px] text-white/40 mt-0.5 leading-none">{bfc.card.typeLine.replace(/^Token\s*/i, "")}</span>
                  )}
                </div>
              )}

              {/* Counter badges */}
              {Object.entries(bfc.counters).filter(([, v]) => v > 0).length > 0 && (
                <div className="absolute -top-1 -right-1 flex flex-col items-end gap-0.5 pointer-events-none" style={{ zIndex: 2 }}>
                  {Object.entries(bfc.counters).filter(([, v]) => v > 0).map(([name, count]) => (
                    <div key={name}
                      className="flex items-center gap-0.5 px-1 rounded-full text-[9px] font-black leading-none py-0.5"
                      style={{ background: counterColor(name), color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", textShadow: "0 1px 2px rgba(0,0,0,0.5)", boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
                      <span>{counterAbbr(name)}</span>
                      <span>×{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tapped ring */}
              {bfc.tapped && <div className="absolute inset-0 rounded-lg ring-1 ring-amber-500/20 pointer-events-none" />}

              {/* Name tooltip */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/bfc:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <span className="text-[9px] text-zinc-300 bg-black/80 px-1.5 py-0.5 rounded">{bfc.card.name}</span>
              </div>
            </div>
          )
        })}

        {/* Zone bar — bottom right */}
        <div className="absolute flex items-end gap-3" style={{ bottom: "calc(50% - min(45%, 345px) + 14px)", right: "calc(50% - min(47.5%, 615px) + 14px)", zIndex: 10 }}>

          {/* Exile */}
          {(() => {
            const ZW = 90, ZH = 126
            const top = ps.exile.at(-1)
            const isTarget = dropTarget === "exile"
            return (
              <div className="flex flex-col items-center gap-1.5">
                <button ref={exileRef}
                  onClick={(e) => { e.stopPropagation(); setShowExile(true) }}
                  className="relative group/exile transition-transform hover:-translate-y-1"
                  style={{ width: ZW, height: ZH }}>
                  {/* Depth cards */}
                  {ps.exile.length > 2 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-4px,-4px)", background: "#1a0a2e", border: "1px solid rgba(139,92,246,0.2)", zIndex: 1 }} />}
                  {ps.exile.length > 1 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-2px,-2px)", background: "#1e0d35", border: "1px solid rgba(139,92,246,0.3)", zIndex: 2 }} />}
                  {/* Main card */}
                  <div className="absolute inset-0 rounded-lg overflow-hidden transition-all" style={{
                    zIndex: 3,
                    border: isTarget ? "2px solid rgba(139,92,246,0.9)" : "1.5px solid rgba(139,92,246,0.5)",
                    boxShadow: isTarget ? "0 0 28px rgba(139,92,246,0.6), 0 4px 24px rgba(139,92,246,0.3)" : "0 4px 24px rgba(139,92,246,0.2)",
                    transition: "border 0.1s, box-shadow 0.1s",
                  }}>
                    {top?.imageUri ? (
                      <img src={top.imageUri} alt="" className="w-full h-full object-cover object-top" style={{ filter: isTarget ? "brightness(0.4) saturate(0.5)" : "brightness(0.55) saturate(0.7)" }} />
                    ) : (
                      <div className="w-full h-full" style={{ background: isTarget ? "rgba(139,92,246,0.18)" : "linear-gradient(145deg,#1a0a2e,#0d0718)", transition: "background 0.1s" }} />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: isTarget ? "rgba(139,92,246,0.22)" : "transparent", transition: "background 0.1s" }}>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-400/80">Exile</span>
                      <span className="text-2xl font-black text-white tabular-nums leading-none" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{ps.exile.length}</span>
                    </div>
                  </div>
                </button>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Exile</span>
              </div>
            )
          })()}

          {/* Graveyard */}
          {(() => {
            const ZW = 90, ZH = 126
            const top = ps.graveyard.at(-1)
            const isTarget = dropTarget === "graveyard"
            return (
              <div className="flex flex-col items-center gap-1.5">
                <button ref={gyRef}
                  onClick={(e) => { e.stopPropagation(); setShowGY(true) }}
                  className="relative group/gy transition-transform hover:-translate-y-1"
                  style={{ width: ZW, height: ZH }}>
                  {/* Depth cards */}
                  {ps.graveyard.length > 2 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-4px,-4px)", background: "#2a0a0a", border: "1px solid rgba(239,68,68,0.15)", zIndex: 1 }} />}
                  {ps.graveyard.length > 1 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-2px,-2px)", background: "#350d0d", border: "1px solid rgba(239,68,68,0.25)", zIndex: 2 }} />}
                  {/* Main card */}
                  <div className="absolute inset-0 rounded-lg overflow-hidden transition-all" style={{
                    zIndex: 3,
                    border: isTarget ? "2px solid rgba(239,68,68,0.85)" : "1.5px solid rgba(239,68,68,0.35)",
                    boxShadow: isTarget ? "0 0 28px rgba(239,68,68,0.55), 0 4px 24px rgba(239,68,68,0.3)" : "0 4px 24px rgba(239,68,68,0.15)",
                    transition: "border 0.1s, box-shadow 0.1s",
                  }}>
                    {top?.imageUri ? (
                      <img src={top.imageUri} alt="" className="w-full h-full object-cover object-top" style={{ filter: isTarget ? "brightness(0.45) saturate(0.5)" : "brightness(0.5) saturate(0.6)" }} />
                    ) : (
                      <div className="w-full h-full" style={{ background: "linear-gradient(145deg,#2a0a0a,#150505)" }} />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: isTarget ? "rgba(239,68,68,0.22)" : "transparent", transition: "background 0.1s" }}>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-red-400/80">Grave</span>
                      <span className="text-2xl font-black text-white tabular-nums leading-none" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{ps.graveyard.length}</span>
                    </div>
                  </div>
                </button>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Graveyard</span>
              </div>
            )
          })()}

          {/* Library */}
          <div className="flex flex-col items-center gap-1.5"
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (ps.library.length > 0) setShowReveal(true) }}>
            <LibraryCard count={ps.library.length} onDraw={drawCard} onView={() => setShowLibrary(true)} />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Library</span>
          </div>
        </div>
      </div>

      {/* ── Hand ───────────────────────────────────────────────────────────── */}
      <div ref={handZoneRef} className="flex-shrink-0 select-none"
        style={{
          background: "rgba(6,7,30,0.96)",
          borderTop: dropTarget === "hand" ? "2px solid rgba(99,179,237,0.7)" : "1px solid rgba(255,255,255,0.05)",
          boxShadow: dropTarget === "hand" ? "0 -8px 32px rgba(99,179,237,0.18)" : "none",
          transition: "border 0.1s, box-shadow 0.1s",
        }}>
        <div className="flex items-end gap-2 px-4 py-3 overflow-x-auto" style={{ minHeight: H + 40 }}>
          {ps.hand.length === 0 ? (
            <div className="flex items-center justify-center w-full">
              <span className="text-xs text-zinc-700">Empty hand</span>
            </div>
          ) : ps.hand.map((card, idx) => {
            const isDragging = handDrag?.idx === idx
            const isFlipped = handFlipped.has(idx)
            const activeUri = isFlipped && card.imageUriBack ? card.imageUriBack : card.imageUri
            return (
              <div key={`${card.scryfallId}-${idx}`}
                className="flex-shrink-0 flex flex-col items-center gap-1 group/hand"
                style={{ opacity: isDragging ? 0.2 : 1, transition: "opacity 0.15s" }}>
                <div style={{ width: W, height: H, position: "relative" }}>
                  {activeUri ? (
                    <img src={activeUri} alt={card.name} draggable={false}
                      className="rounded-lg shadow-lg select-none transition-all duration-150 group-hover/hand:-translate-y-2 group-hover/hand:shadow-2xl"
                      style={{
                        width: W, height: H, objectFit: "cover", objectPosition: "top",
                        cursor: ps.mulliganPhase === "playing" ? "grab" : "default",
                        outline: ps.mulliganPhase === "bottoming" && ps.bottomSelected.has(idx) ? "2px solid rgba(239,68,68,0.9)" : "none",
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0 || ps.mulliganPhase !== "playing") return
                        e.preventDefault()
                        setHandDrag({ idx, card, x: e.clientX, y: e.clientY })
                      }}
                      onDoubleClick={() => setZoomed(activeUri)}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setHandCtx({ idx, x: e.clientX, y: e.clientY }) }}
                    />
                  ) : (
                    <div className="rounded-lg flex items-center justify-center text-[9px] text-zinc-400 text-center p-1 cursor-grab"
                      style={{ width: W, height: H, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)" }}
                      onMouseDown={(e) => {
                        if (e.button !== 0 || ps.mulliganPhase !== "playing") return
                        e.preventDefault()
                        setHandDrag({ idx, card, x: e.clientX, y: e.clientY })
                      }}>
                      {card.name}
                    </div>
                  )}

                  {/* Flip button */}
                  {card.imageUriBack && ps.mulliganPhase === "playing" && (
                    <button
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover/hand:opacity-100 transition-opacity"
                      style={{ background: "rgba(0,0,0,0.82)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px", lineHeight: 0 }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setHandFlipped(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n }) }}>
                      <FlipHorizontal2 className="w-3 h-3 text-sky-400" />
                    </button>
                  )}

                  {/* Mulligan overlay */}
                  {ps.mulliganPhase === "bottoming" && (
                    <div className="absolute inset-0 rounded-lg cursor-pointer"
                      style={{ background: ps.bottomSelected.has(idx) ? "rgba(239,68,68,0.42)" : "transparent", transition: "background 0.1s" }}
                      onClick={() => toggleBottom(idx)}>
                      {ps.bottomSelected.has(idx) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white bg-red-600/80 rounded px-1.5 py-0.5">Bottom</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-zinc-600 truncate text-center leading-tight select-none" style={{ maxWidth: W }}>
                  {card.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Drag ghost ─────────────────────────────────────────────────────── */}
      {(handDrag || cmdDrag) && (() => {
        const drag = (handDrag ?? cmdDrag)!
        const card = drag.card
        const uri = card.imageUri
        return (
          <div className="fixed pointer-events-none z-[500]"
            style={{ left: drag.x - W / 2, top: drag.y - H / 2, width: W, height: H, opacity: 0.92, transform: "scale(1.07) rotate(-1.5deg)", filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.85))" }}>
            {uri ? (
              <img src={uri} alt={card.name} draggable={false} className="w-full h-full rounded-lg" style={{ objectFit: "cover", objectPosition: "top" }} />
            ) : (
              <div className="w-full h-full rounded-lg flex items-center justify-center text-[9px] text-zinc-400 p-1" style={{ background: "#1a1a2e" }}>
                {card.name}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Battlefield context menu ────────────────────────────────────────── */}
      {bfCtx && (() => {
        const bfc = ps.battlefield.find(b => b.id === bfCtx.id)
        const activeUri = bfc ? (bfc.flipped && bfc.card.imageUriBack ? bfc.card.imageUriBack : bfc.card.imageUri) : null
        const abilities = bfc ? parseCardAbilities(bfc.card.oracleText ?? "", bfc.card.typeLine) : null

        // ── Section: game actions ──────────────────────────────────────────
        const isCommanderOnBF = bfc ? cmdCards.current.some(c => c.scryfallId === bfc.card.scryfallId) : false
        const gameItems: { label: string; action: () => void }[] = [
          { label: bfc?.tapped ? "Untap" : "Tap", action: () => tap(bfCtx.id) },
          ...(bfc?.card.imageUriBack ? [{ label: bfc.flipped ? "Show Front Face" : "Show Back Face", action: () => flipBF(bfCtx.id) }] : []),
          { label: "Copy to Battlefield", action: () => copyToBF(bfCtx.id) },
          { label: "Bounce to Hand", action: () => bounce(bfCtx.id) },
          { label: "Place on Top of Library", action: () => toTopOfLib(bfCtx.id) },
          ...(isCommanderOnBF ? [{ label: "Return to Command Zone", action: () => returnToCommandZone(bfCtx.id) }] : []),
          { label: "To Graveyard", action: () => toGY(bfCtx.id) },
          { label: "To Exile", action: () => toExile(bfCtx.id) },
          { label: "Zoom", action: () => { if (activeUri) setZoomed(activeUri) } },
        ]

        // ── Section: planeswalker loyalty abilities ────────────────────────
        const loyaltyItems = abilities?.loyaltyAbilities.map(a => ({
          label: a.label,
          action: () => addCounter(bfCtx.id, "loyalty", a.delta),
          color: a.delta >= 0 ? "#22c55e" : "#ef4444",
        })) ?? []

        // ── Section: counter actions from oracle text ──────────────────────
        const counterItems: { label: string; action: () => void; color?: string }[] = []

        // All creatures always get +1/+1 and -1/-1 counter options
        if (bfc && /creature/i.test(bfc.card.typeLine)) {
          const p1p1 = bfc.counters["+1/+1"] ?? 0
          const m1m1 = bfc.counters["-1/-1"] ?? 0
          counterItems.push({ label: `Add +1/+1 Counter${p1p1 > 0 ? ` (${p1p1})` : ""}`, action: () => addCounter(bfCtx.id, "+1/+1", 1), color: "#22c55e" })
          if (p1p1 > 0) counterItems.push({ label: `Remove +1/+1 Counter`, action: () => addCounter(bfCtx.id, "+1/+1", -1), color: "#22c55e" })
          counterItems.push({ label: `Add -1/-1 Counter${m1m1 > 0 ? ` (${m1m1})` : ""}`, action: () => addCounter(bfCtx.id, "-1/-1", 1), color: "#ef4444" })
          if (m1m1 > 0) counterItems.push({ label: `Remove -1/-1 Counter`, action: () => addCounter(bfCtx.id, "-1/-1", -1), color: "#ef4444" })
        }

        const isCreature = bfc ? /creature/i.test(bfc.card.typeLine) : false
        for (const name of (abilities?.counterNames ?? [])) {
          if (name === "loyalty") continue // handled via loyalty abilities
          if (isCreature && (name === "+1/+1" || name === "-1/-1")) continue // already added above
          const color = counterColor(name)
          const current = bfc?.counters[name] ?? 0
          counterItems.push({
            label: `Add ${name} Counter${current > 0 ? ` (${current})` : ""}`,
            action: () => addCounter(bfCtx.id, name, 1),
            color,
          })
          if (current > 0) {
            counterItems.push({
              label: `Remove ${name} Counter`,
              action: () => addCounter(bfCtx.id, name, -1),
              color,
            })
          }
        }
        // Always allow removing any counter currently on this card even if not in oracle text
        if (bfc) {
          for (const [name, count] of Object.entries(bfc.counters)) {
            const alreadyShown = name === "loyalty" || (isCreature && (name === "+1/+1" || name === "-1/-1"))
            if (count > 0 && !(abilities?.counterNames ?? []).includes(name) && !alreadyShown) {
              counterItems.push({
                label: `Remove ${name} Counter (${count})`,
                action: () => addCounter(bfCtx.id, name, -1),
                color: counterColor(name),
              })
            }
          }
        }

        type Item = { label: string; action: () => void; color?: string }
        const Divider = () => <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "2px 0" }} />
        const Btn = ({ item }: { item: Item }) => (
          <button onClick={() => { item.action(); setBfCtx(null) }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.07] transition-colors flex items-center gap-2"
            style={{ color: item.color ? "rgba(255,255,255,0.85)" : "#d4d4d8" }}>
            {item.color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />}
            {item.label}
          </button>
        )

        return (
          <div className="fixed z-[9999] rounded-xl shadow-2xl overflow-hidden py-1"
            style={{ left: bfCtx.x, top: bfCtx.y, background: "#111118", border: "1px solid rgba(255,255,255,0.10)", minWidth: 210, maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            {gameItems.map(item => <Btn key={item.label} item={item} />)}
            {loyaltyItems.length > 0 && <><Divider />{loyaltyItems.map(item => <Btn key={item.label} item={item} />)}</>}
            {counterItems.length > 0 && <><Divider />{counterItems.map(item => <Btn key={item.label} item={item} />)}</>}
        <Divider />
        <button onClick={() => { setCustomCounter({ bfcId: bfCtx.id }); setBfCtx(null) }}
          className="w-full text-left px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-300 transition-colors">
          Add Custom Counter…
        </button>
          </div>
        )
      })()}

      {/* ── Hand context menu ───────────────────────────────────────────────── */}
      {handCtx && (
        <div className="fixed z-[9999] rounded-xl shadow-2xl overflow-hidden py-1"
          style={{ left: handCtx.x, top: handCtx.y, background: "#111118", border: "1px solid rgba(255,255,255,0.10)", minWidth: 160 }}
          onClick={(e) => e.stopPropagation()}>
          {[
            { label: "Zoom", action: () => {
              const c = ps.hand[handCtx.idx]
              const uri = (handFlipped.has(handCtx.idx) && c?.imageUriBack) ? c.imageUriBack : c?.imageUri
              if (uri) setZoomed(uri)
            }},
            { label: "Discard to Graveyard", action: () => handToGY(handCtx.idx) },
            { label: "Place on Top of Library", action: () => handToTop(handCtx.idx) },
            { label: "Put on Bottom of Library", action: () => handToBottom(handCtx.idx) },
          ].map(({ label, action }) => (
            <button key={label} onClick={() => { action(); setHandCtx(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white transition-colors">
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Zone modals ─────────────────────────────────────────────────────── */}
      {showGY && (
        <ZoneModal title="Graveyard" cards={ps.graveyard}
          actions={[
            { label: "Return to Hand",        action: gyToHand   },
            { label: "Play to Battlefield",   action: gyToBF     },
            { label: "Put on Top of Library", action: gyToTopLib },
            { label: "Send to Exile",         action: gyToExile  },
          ]}
          onClose={() => setShowGY(false)} />
      )}
      {showExile && (
        <ZoneModal title="Exile" cards={ps.exile}
          actions={[
            { label: "Return to Hand",        action: exileToHand   },
            { label: "Play to Battlefield",   action: exileToBF     },
            { label: "Put on Top of Library", action: exileToTopLib },
            { label: "Send to Graveyard",     action: exileToGY     },
          ]}
          onClose={() => setShowExile(false)} />
      )}
      {showLibrary && (
        <LibraryModal library={ps.library} onClose={() => setShowLibrary(false)} onDrawSpecific={drawSpecific} />
      )}

      {/* ── Reveal top card ─────────────────────────────────────────────────── */}
      {showReveal && ps.library.length > 0 && (
        <RevealModal
          card={ps.library[0]}
          onDraw={() => { drawCard(); setShowReveal(false) }}
          onBottom={() => { libTopToBottom(); setShowReveal(false) }}
          onGY={() => { libTopToGY(); setShowReveal(false) }}
          onExile={() => { libTopToExile(); setShowReveal(false) }}
          onClose={() => setShowReveal(false)}
        />
      )}

      {/* ── Custom counter modal ────────────────────────────────────────────── */}
      {customCounter && (
        <CustomCounterModal
          existingCounters={ps.battlefield.find(b => b.id === customCounter.bfcId)?.counters ?? {}}
          onAdd={(name) => { addCounter(customCounter.bfcId, name, 1); setCustomCounter(null) }}
          onClose={() => setCustomCounter(null)}
        />
      )}

      {/* ── Scry modal ──────────────────────────────────────────────────────── */}
      {scryN !== null && (
        <ScryModal
          cards={ps.library.slice(0, scryN)}
          n={scryN}
          maxN={ps.library.length}
          onChangeN={setScryN}
          onConfirm={({ topCards, bottomCards, gyCards }) => { scryKeepTop(topCards, bottomCards, gyCards); setScryN(null) }}
          onClose={() => setScryN(null)}
        />
      )}

      {/* ── Mill modal ──────────────────────────────────────────────────────── */}
      {millN !== null && (
        <MillModal
          library={ps.library}
          n={millN}
          onChangeN={setMillN}
          onConfirm={(n) => { mill(n); setMillN(null) }}
          onClose={() => setMillN(null)}
        />
      )}

      {/* ── Token Creator ───────────────────────────────────────────────────── */}
      {showTokenCreator && (
        <TokenCreator
          onCreate={(name, colors, typeLine, qty) => { createToken(name, colors, typeLine, qty); setShowTokenCreator(false) }}
          onClose={() => setShowTokenCreator(false)}
        />
      )}

      {/* ── Zoom ────────────────────────────────────────────────────────────── */}
      {zoomed && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setZoomed(null)}>
          <img src={zoomed} alt="" className="rounded-2xl shadow-2xl"
            style={{ maxHeight: "90vh", maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

// ── LibraryCard ───────────────────────────────────────────────────────────────
function LibraryCard({ count, onDraw, onView }: { count: number; onDraw: () => void; onView: () => void }) {
  const [urlIdx, setUrlIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const tryNext = () => urlIdx + 1 < CARD_BACK_URLS.length ? setUrlIdx(i => i + 1) : setFailed(true)
  const empty = count === 0
  const ZW = 90, ZH = 126
  const src = failed ? null : CARD_BACK_URLS[urlIdx]

  // Depth layers use css background-image so they don't need onError — they just show dark if url fails
  const depthBg = src ? `url('${src}') center/cover` : "#0e1f3d"

  return (
    <div className="relative group/lib" style={{ width: ZW, height: ZH }}>
      {/* Depth stack — actual card back images offset behind */}
      {count > 4 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-6px,-6px)", background: depthBg, border: "1px solid rgba(44,82,152,0.35)", zIndex: 1, opacity: 0.6 }} />}
      {count > 2 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-4px,-4px)", background: depthBg, border: "1px solid rgba(44,82,152,0.45)", zIndex: 2, opacity: 0.75 }} />}
      {count > 1 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-2px,-2px)", background: depthBg, border: "1px solid rgba(44,82,152,0.55)", zIndex: 3, opacity: 0.88 }} />}

      {/* Main card */}
      <button
        onClick={(e) => { e.stopPropagation(); onDraw() }}
        disabled={empty}
        title="Click to draw · D"
        className="absolute inset-0 rounded-lg overflow-hidden transition-transform hover:-translate-y-1 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ zIndex: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.7)" }}
      >
        {src ? (
          <img key={urlIdx} src={src} alt="Library"
            className="w-full h-full object-cover" draggable={false} onError={tryNext} />
        ) : (
          <div className="w-full h-full" style={{ background: "#0e1f3d", border: "1.5px solid #1a3a7a" }} />
        )}
        {/* Count badge */}
        {!empty && (
          <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
            <span className="text-xs font-black text-white tabular-nums px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>{count}</span>
          </div>
        )}
        {/* Draw overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/lib:opacity-100 transition-opacity rounded-lg" style={{ background: "rgba(0,0,0,0.55)" }}>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Draw</span>
        </div>
      </button>

      {/* Browse button */}
      <button
        onClick={(e) => { e.stopPropagation(); onView() }}
        title="Browse library"
        className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover/lib:opacity-100 transition-all shadow-lg z-10"
        style={{ background: "#18181f", border: "1px solid rgba(255,255,255,0.18)" }}
      >
        <Eye className="w-3 h-3 text-zinc-300" />
      </button>
    </div>
  )
}

// ── CmdZoneCard ───────────────────────────────────────────────────────────────
function CmdZoneCard({ cmd, castCount, onCastCountChange, onDragStart }: {
  cmd: CardInDeck
  castCount: number
  onCastCountChange: (d: number) => void
  onDragStart: (e: React.MouseEvent) => void
}) {
  const [flipped, setFlipped] = useState(false)
  const uri = flipped && cmd.imageUriBack ? cmd.imageUriBack : cmd.imageUri
  const isCompanion = !!cmd.isCompanion
  const borderColor = isCompanion ? "rgba(129,140,248,0.5)" : "rgba(245,158,11,0.5)"
  const label = isCompanion ? "Drag to hand" : "Drag to battlefield"
  const tax = castCount * 2
  return (
    <div className="relative group" style={{ width: W, cursor: "grab" }}>
      {uri ? (
        <img src={uri} alt={cmd.name} draggable={false} className="rounded-lg shadow-2xl select-none"
          style={{ width: W, height: H, objectFit: "cover", objectPosition: "top", border: `1.5px solid ${borderColor}` }}
          onMouseDown={onDragStart} />
      ) : (
        <div className="rounded-lg flex items-center justify-center text-[9px] text-center p-1"
          style={{ width: W, height: H, background: "#1a1a2e", border: `1.5px solid ${borderColor}`, color: isCompanion ? "#818cf8" : "#fcd34d", cursor: "grab" }}
          onMouseDown={onDragStart}>
          {cmd.name}
        </div>
      )}

      {/* Cast count / tax badge */}
      {!isCompanion && (
        <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between pointer-events-none"
          style={{ zIndex: 2 }}>
          <div className="flex items-center gap-0.5 rounded px-1 py-0.5 pointer-events-auto"
            style={{ background: "rgba(0,0,0,0.82)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <button onMouseDown={e => e.stopPropagation()} onClick={() => onCastCountChange(-1)}
              disabled={castCount === 0}
              className="text-[9px] text-zinc-600 hover:text-white disabled:opacity-30 w-3 text-center leading-none">−</button>
            <span className="text-[9px] font-bold text-zinc-400 mx-0.5">{castCount}×</span>
            <button onMouseDown={e => e.stopPropagation()} onClick={() => onCastCountChange(+1)}
              className="text-[9px] text-zinc-600 hover:text-white w-3 text-center leading-none">+</button>
          </div>
          {tax > 0 && (
            <span className="text-[8px] font-bold rounded px-1 py-0.5"
              style={{ background: "rgba(0,0,0,0.82)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
              +{tax}
            </span>
          )}
        </div>
      )}

      {isCompanion && (
        <div className="absolute top-1 left-1 text-[8px] font-bold px-1 py-0.5 rounded"
          style={{ background: "rgba(129,140,248,0.25)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.4)" }}>
          Companion
        </div>
      )}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 flex items-end justify-center pb-8 gap-1.5 transition-opacity pointer-events-none"
        style={{ background: "rgba(0,0,0,0.45)" }}>
        <span className="text-[8px] font-semibold text-zinc-300">{label}</span>
        {cmd.imageUriBack && (
          <button className="p-1 rounded-md pointer-events-auto" onMouseDown={e => e.stopPropagation()} onClick={() => setFlipped(f => !f)}
            style={{ background: "rgba(14,165,233,0.2)", border: "1px solid rgba(14,165,233,0.4)" }}>
            <FlipHorizontal2 className="w-3 h-3 text-sky-400" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── LibraryModal ──────────────────────────────────────────────────────────────
function LibraryModal({ library, onClose, onDrawSpecific }: { library: CardInDeck[]; onClose: () => void; onDrawSpecific: (idx: number) => void }) {
  const [query, setQuery] = useState("")
  const filtered = library.map((c, i) => ({ c, i })).filter(({ c }) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}
      onClick={onClose}>
      <div className="rounded-2xl shadow-2xl flex flex-col" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)", width: 340, height: 560 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-sm font-bold text-zinc-200">Library <span className="text-zinc-600 font-normal text-xs">({library.length} cards)</span></h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-3 pt-2 pb-1 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search library…" autoFocus
              className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-2 pb-3 space-y-px" style={{ minHeight: 0 }}>
          {filtered.length === 0 && <p className="text-xs text-zinc-700 text-center py-6">No cards found</p>}
          {filtered.map(({ c, i }) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors group/row">
              <span className="text-[9px] text-zinc-700 tabular-nums w-5 text-right flex-shrink-0">{i + 1}</span>
              {c.imageUri && <img src={c.imageUri} alt="" draggable={false} className="rounded flex-shrink-0 object-cover object-top" style={{ width: 22, height: 31 }} />}
              <span className="text-xs text-zinc-300 truncate flex-1">{c.name}</span>
              <button onClick={() => { onDrawSpecific(i); onClose() }}
                className="text-[9px] text-zinc-700 hover:text-amber-400 opacity-0 group-hover/row:opacity-100 transition-all flex-shrink-0 font-semibold">
                Draw
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ZoneModal ─────────────────────────────────────────────────────────────────
interface ZoneAction { label: string; action: (idx: number) => void }

function ZoneModal({ title, cards, actions, onClose }: { title: string; cards: CardInDeck[]; actions: ZoneAction[]; onClose: () => void }) {
  const [ctxMenu, setCtxMenu] = useState<{ idx: number; x: number; y: number } | null>(null)
  const [zoomed, setZoomed] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}
      onClick={() => { setCtxMenu(null); onClose() }}>
      <div className="rounded-2xl shadow-2xl flex flex-col" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)", width: 360, height: 520 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-sm font-bold text-zinc-200">{title} <span className="text-zinc-600 font-normal text-xs">({cards.length})</span></h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-3 py-2 space-y-px" style={{ minHeight: 0 }}>
          {cards.length === 0 && <p className="text-xs text-zinc-700 text-center py-8">Empty</p>}
          {cards.map((c, i) => (
            <div key={i}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors cursor-context-menu select-none"
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ idx: i, x: e.clientX, y: e.clientY }) }}>
              {c.imageUri && <img src={c.imageUri} alt="" draggable={false} className="rounded object-cover object-top flex-shrink-0" style={{ width: 26, height: 37 }} />}
              <span className="text-xs text-zinc-300 truncate flex-1">{c.name}</span>
              <span className="text-[9px] text-zinc-700">right-click</span>
            </div>
          ))}
        </div>
      </div>

      {ctxMenu && (
        <div className="fixed z-[300] rounded-xl shadow-2xl overflow-hidden py-1"
          style={{ left: ctxMenu.x, top: ctxMenu.y, background: "#111118", border: "1px solid rgba(255,255,255,0.11)", minWidth: 175 }}
          onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { const uri = cards[ctxMenu.idx]?.imageUri; if (uri) setZoomed(uri); setCtxMenu(null) }}
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white transition-colors">
            Zoom
          </button>
          {actions.map(({ label, action }) => (
            <button key={label} onClick={() => { action(ctxMenu.idx); setCtxMenu(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white transition-colors">
              {label}
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.90)" }}
          onClick={() => setZoomed(null)}>
          <img src={zoomed} alt="" className="rounded-2xl shadow-2xl" style={{ maxHeight: "90vh", maxWidth: 440 }} />
        </div>
      )}
    </div>
  )
}

// ── TokenCreator ──────────────────────────────────────────────────────────────
const TOKEN_PRESETS: { name: string; colors: string[]; typeLine: string }[] = [
  { name: "Treasure",    colors: [],        typeLine: "Token Artifact"                    },
  { name: "Clue",        colors: [],        typeLine: "Token Artifact"                    },
  { name: "Food",        colors: [],        typeLine: "Token Artifact"                    },
  { name: "Blood",       colors: [],        typeLine: "Token Artifact"                    },
  { name: "Map",         colors: [],        typeLine: "Token Artifact"                    },
  { name: "Gold",        colors: [],        typeLine: "Token Artifact"                    },
  { name: "1/1 Soldier", colors: ["W"],     typeLine: "Token Creature — Soldier"          },
  { name: "1/1 Spirit",  colors: ["W"],     typeLine: "Token Creature — Spirit"           },
  { name: "2/2 Knight",  colors: ["W"],     typeLine: "Token Creature — Knight"           },
  { name: "1/1 Elf",     colors: ["G"],     typeLine: "Token Creature — Elf"              },
  { name: "3/3 Beast",   colors: ["G"],     typeLine: "Token Creature — Beast"            },
  { name: "2/2 Wolf",    colors: ["G"],     typeLine: "Token Creature — Wolf"             },
  { name: "2/2 Zombie",  colors: ["B"],     typeLine: "Token Creature — Zombie"           },
  { name: "1/1 Goblin",  colors: ["R"],     typeLine: "Token Creature — Goblin"           },
  { name: "1/1 Thopter", colors: ["U"],     typeLine: "Token Artifact Creature — Thopter"},
  { name: "2/2 Golem",   colors: [],        typeLine: "Token Artifact Creature — Golem"  },
  { name: "1/1 Snake",   colors: ["G","B"], typeLine: "Token Creature — Snake"            },
]

const COLOR_HEX: Record<string, string> = { W: "#d4b848", U: "#4a7fbf", B: "#9b59b6", R: "#e74c3c", G: "#2ecc71" }

function TokenCreator({ onCreate, onClose }: {
  onCreate: (name: string, colors: string[], typeLine: string, qty: number) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [colors, setColors] = useState<string[]>([])
  const [typeLine, setTypeLine] = useState("Token Creature")
  const [qty, setQty] = useState(1)

  const toggleColor = (c: string) =>
    setColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const submit = () => { if (name.trim()) onCreate(name.trim(), colors, typeLine, qty) }

  const presetBg = (p: typeof TOKEN_PRESETS[0]) => {
    if (p.colors.length === 0) return "rgba(100,100,120,0.15)"
    if (p.colors.length >= 2) return "rgba(180,150,50,0.15)"
    return `${COLOR_HEX[p.colors[0]]}22`
  }
  const presetBorder = (p: typeof TOKEN_PRESETS[0]) => {
    if (p.colors.length === 0) return "rgba(100,100,120,0.25)"
    if (p.colors.length >= 2) return "rgba(180,150,50,0.3)"
    return `${COLOR_HEX[p.colors[0]]}44`
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)", width: 380, maxHeight: "82vh" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-sm font-bold text-zinc-200">Create Token</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Presets */}
          <div className="px-4 pt-3 pb-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">Quick Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {TOKEN_PRESETS.map(p => (
                <button key={p.name}
                  onClick={() => onCreate(p.name, p.colors, p.typeLine, qty)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                  style={{ background: presetBg(p), border: `1px solid ${presetBorder(p)}` }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom */}
          <div className="px-4 py-3 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] uppercase tracking-widest text-zinc-600">Custom Token</p>

            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder='e.g. "3/3 Beast" or "Treasure"'
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            />

            <div className="flex gap-1.5">
              {["Token Creature", "Token Artifact", "Token Artifact Creature", "Token"].map(t => (
                <button key={t} onClick={() => setTypeLine(t)}
                  className="flex-1 py-1 rounded-lg text-[9px] font-semibold transition-colors"
                  style={{
                    background: typeLine === t ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    color: typeLine === t ? "#fff" : "#71717a",
                    border: `1px solid ${typeLine === t ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  {t === "Token Artifact Creature" ? "Art. Creature" : t.replace("Token ", "")}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[9px] text-zinc-600 flex-shrink-0">Color</span>
              <div className="flex gap-2">
                {(["W","U","B","R","G"] as const).map(c => (
                  <button key={c} onClick={() => toggleColor(c)}
                    className="w-6 h-6 rounded-full text-[10px] font-black transition-all"
                    style={{
                      background: colors.includes(c) ? COLOR_HEX[c] : "rgba(255,255,255,0.06)",
                      color: colors.includes(c) ? (c === "W" ? "#000" : "#fff") : "#71717a",
                      border: `1.5px solid ${colors.includes(c) ? COLOR_HEX[c] : "rgba(255,255,255,0.12)"}`,
                      boxShadow: colors.includes(c) ? `0 0 8px ${COLOR_HEX[c]}55` : "none",
                    }}>
                    {c}
                  </button>
                ))}
                {colors.length > 0 && (
                  <button onClick={() => setColors([])}
                    className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors">clear</button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[9px] text-zinc-600">Qty</span>
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-5 h-5 rounded text-sm font-bold text-zinc-400 hover:text-white flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.06)" }}>−</button>
                <span className="text-xs font-bold text-white w-5 text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(20, q + 1))}
                  className="w-5 h-5 rounded text-sm font-bold text-zinc-400 hover:text-white flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.06)" }}>+</button>
              </div>
              <button onClick={submit} disabled={!name.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-30"
                style={{ background: "rgba(99,102,241,0.22)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.35)" }}>
                Create{qty > 1 ? ` ×${qty}` : ""}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ScryModal ─────────────────────────────────────────────────────────────────
type ScryDest = "top" | "bottom" | "gy"
interface ScryItem { card: CardInDeck; dest: ScryDest; key: string }

const SCRY_DEST_STYLE: Record<ScryDest, { bg: string; border: string; color: string; label: string }> = {
  top:    { bg: "rgba(34,197,94,0.09)",   border: "rgba(34,197,94,0.22)",   color: "#4ade80", label: "Top"    },
  bottom: { bg: "rgba(96,165,250,0.09)",  border: "rgba(96,165,250,0.22)",  color: "#93c5fd", label: "Bottom" },
  gy:     { bg: "rgba(248,113,113,0.09)", border: "rgba(248,113,113,0.22)", color: "#fca5a5", label: "GY"     },
}

function ScryModal({ cards, n, maxN, onChangeN, onConfirm, onClose }: {
  cards: CardInDeck[]
  n: number
  maxN: number
  onChangeN: (n: number) => void
  onConfirm: (result: { topCards: CardInDeck[]; bottomCards: CardInDeck[]; gyCards: CardInDeck[] }) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<ScryItem[]>(() =>
    cards.map((c, i) => ({ card: c, dest: "top" as ScryDest, key: `${c.scryfallId}-${i}` }))
  )

  useEffect(() => {
    setItems(cards.map((c, i) => ({ card: c, dest: "top" as ScryDest, key: `${c.scryfallId}-${i}` })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  const cycleDest = (idx: number) =>
    setItems(prev => prev.map((item, i) =>
      i !== idx ? item : { ...item, dest: item.dest === "top" ? "bottom" : item.dest === "bottom" ? "gy" : "top" }
    ))

  const setDestDirect = (idx: number, dest: ScryDest) =>
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, dest }))

  const move = (idx: number, dir: -1 | 1) =>
    setItems(prev => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })

  const confirm = () =>
    onConfirm({
      topCards:    items.filter(x => x.dest === "top").map(x => x.card),
      bottomCards: items.filter(x => x.dest === "bottom").map(x => x.card),
      gyCards:     items.filter(x => x.dest === "gy").map(x => x.card),
    })

  // Compute running position label among top-destined cards
  let topCounter = 0
  const itemsWithPos = items.map(item => {
    if (item.dest === "top") topCounter++
    return { ...item, pos: item.dest === "top" ? topCounter : 0 }
  })

  const topCount = items.filter(x => x.dest === "top").length
  const botCount = items.filter(x => x.dest === "bottom").length
  const gyCount  = items.filter(x => x.dest === "gy").length

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)", width: 420, height: 560 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-zinc-200">Scry / Surveil</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => onChangeN(Math.max(1, n - 1))}
                className="w-5 h-5 rounded text-sm font-bold text-zinc-500 hover:text-white flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)" }}>−</button>
              <span className="text-sm font-bold text-white w-5 text-center">{n}</span>
              <button onClick={() => onChangeN(Math.min(maxN, n + 1))}
                className="w-5 h-5 rounded text-sm font-bold text-zinc-500 hover:text-white flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)" }}>+</button>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold">
              {topCount > 0 && <span style={{ color: "#4ade80" }}>{topCount} top</span>}
              {botCount > 0 && <span style={{ color: "#93c5fd" }}>{botCount} bottom</span>}
              {gyCount  > 0 && <span style={{ color: "#fca5a5" }}>{gyCount} GY</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Hint bar */}
        <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span className="text-[9px] text-zinc-700">▲▼ to reorder · click badge to cycle Top → Bottom → GY</span>
          <div className="flex items-center gap-2 text-[9px]">
            {(["top","bottom","gy"] as ScryDest[]).map(d => (
              <span key={d} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: SCRY_DEST_STYLE[d].color }} />
                <span style={{ color: SCRY_DEST_STYLE[d].color }}>{SCRY_DEST_STYLE[d].label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Card list */}
        <div className="overflow-y-auto flex-1 px-3 py-2 flex flex-col gap-1" style={{ minHeight: 0 }}>
          {itemsWithPos.map((item, i) => {
            const st = SCRY_DEST_STYLE[item.dest]
            return (
              <div key={item.key}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl select-none"
                style={{ background: st.bg, border: `1px solid ${st.border}` }}>

                {/* Reorder arrows */}
                <div className="flex flex-col flex-shrink-0" style={{ gap: 2 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="w-4 h-3 flex items-center justify-center text-zinc-700 hover:text-white disabled:opacity-20 transition-colors"
                    style={{ fontSize: 8, lineHeight: 1 }}>▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                    className="w-4 h-3 flex items-center justify-center text-zinc-700 hover:text-white disabled:opacity-20 transition-colors"
                    style={{ fontSize: 8, lineHeight: 1 }}>▼</button>
                </div>

                {/* Position number (top-cards only) */}
                <span className="text-[10px] font-black tabular-nums w-4 text-center flex-shrink-0"
                  style={{ color: item.dest === "top" ? st.color : "rgba(255,255,255,0.12)" }}>
                  {item.dest === "top" ? item.pos : "—"}
                </span>

                {/* Thumbnail */}
                {item.card.imageUri ? (
                  <img src={item.card.imageUri} alt="" draggable={false}
                    className="rounded flex-shrink-0 object-cover object-top"
                    style={{ width: 26, height: 36 }} />
                ) : (
                  <div className="rounded flex-shrink-0" style={{ width: 26, height: 36, background: "#1a1a2e" }} />
                )}

                {/* Card name */}
                <span className="text-xs text-zinc-200 flex-1 truncate">{item.card.name}</span>

                {/* Quick-set dots */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(["top","bottom","gy"] as ScryDest[]).map(d => (
                    <button key={d} onClick={() => setDestDirect(i, d)} title={SCRY_DEST_STYLE[d].label}
                      className="transition-all"
                      style={{
                        width: 8, height: 8, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
                        background: item.dest === d ? SCRY_DEST_STYLE[d].color : "rgba(255,255,255,0.1)",
                        boxShadow: item.dest === d ? `0 0 5px ${SCRY_DEST_STYLE[d].color}88` : "none",
                      }} />
                  ))}
                </div>

                {/* Dest badge — cycles on click */}
                <button onClick={() => cycleDest(i)}
                  className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all hover:brightness-125"
                  style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}55`, minWidth: 40, textAlign: "center" }}>
                  {st.label}
                </button>
              </div>
            )
          })}
        </div>

        {/* Confirm */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={confirm}
            className="w-full py-2 rounded-xl text-xs font-bold transition-colors"
            style={{ background: "rgba(99,102,241,0.22)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.35)" }}>
            Confirm — {topCount > 0 ? `${topCount} on top` : "none on top"}
            {botCount > 0 ? ` · ${botCount} to bottom` : ""}
            {gyCount  > 0 ? ` · ${gyCount} to GY` : ""}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MillModal ─────────────────────────────────────────────────────────────────
function MillModal({ library, n, onChangeN, onConfirm, onClose }: {
  library: CardInDeck[]
  n: number
  onChangeN: (n: number) => void
  onConfirm: (n: number) => void
  onClose: () => void
}) {
  const cards = library.slice(0, n)
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)", width: 340, height: 520 }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-200">Mill</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => onChangeN(Math.max(1, n - 1))}
                className="w-5 h-5 rounded text-sm font-bold text-zinc-500 hover:text-white flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)" }}>−</button>
              <span className="text-sm font-bold text-white w-5 text-center">{n}</span>
              <button onClick={() => onChangeN(Math.min(library.length, n + 1))}
                className="w-5 h-5 rounded text-sm font-bold text-zinc-500 hover:text-white flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)" }}>+</button>
            </div>
            <span className="text-[9px] text-zinc-600">cards to graveyard</span>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-3 py-2 space-y-px" style={{ minHeight: 0 }}>
          {cards.length === 0 && <p className="text-xs text-zinc-700 text-center py-6">Library is empty</p>}
          {cards.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.06)" }}>
              <span className="text-[9px] text-zinc-700 w-4 text-right flex-shrink-0">{i + 1}</span>
              {c.imageUri && <img src={c.imageUri} alt="" draggable={false} className="rounded flex-shrink-0 object-cover object-top" style={{ width: 22, height: 31 }} />}
              <span className="text-xs text-zinc-300 truncate">{c.name}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 pt-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => onConfirm(n)} disabled={library.length === 0}
            className="w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-30"
            style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}>
            Mill {n} {n === 1 ? "card" : "cards"} → Graveyard
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OpponentsPanel ────────────────────────────────────────────────────────────
function OpponentsPanel({ opponents, commanders, onAdjustLife, onAdjustCmdDamage, onRename }: {
  opponents: Opponent[]
  commanders: CardInDeck[]
  onAdjustLife: (idx: number, d: number) => void
  onAdjustCmdDamage: (oppIdx: number, cmdName: string, d: number) => void
  onRename: (idx: number, name: string) => void
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  const lifeColor = (life: number) =>
    life <= 0 ? "#6b7280" : life <= 5 ? "#ef4444" : life <= 10 ? "#f97316" : "#e4e4e7"

  const shortCmd = (name: string) => {
    const beforeComma = name.split(",")[0].trim()
    const words = beforeComma.split(" ")
    return words.length <= 2 ? beforeComma : words.slice(-1)[0]
  }

  return (
    <div className="select-none w-full rounded-xl shadow-2xl overflow-visible"
      style={{ background: "rgba(8,8,18,0.94)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-px px-2 py-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mr-2">Opponents</span>
        {opponents.map((opp, i) => {
          const isDead = opp.life <= 0
          return (
            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                marginLeft: i > 0 ? 4 : 0,
              }}>
              {/* Name */}
              {editingIdx === i ? (
                <input
                  value={opp.name}
                  onChange={e => onRename(i, e.target.value)}
                  onBlur={() => setEditingIdx(null)}
                  onKeyDown={e => e.key === "Enter" && setEditingIdx(null)}
                  autoFocus
                  className="w-16 text-[9px] font-semibold bg-transparent focus:outline-none text-zinc-200 border-b border-zinc-600"
                />
              ) : (
                <span onClick={() => setEditingIdx(i)}
                  className="text-[9px] font-semibold text-zinc-400 hover:text-zinc-200 cursor-text max-w-[56px] truncate transition-colors">
                  {isDead ? "💀" : ""}{opp.name}
                </span>
              )}
              {/* Life */}
              <button onClick={() => onAdjustLife(i, -1)}
                className="w-3.5 h-3.5 flex items-center justify-center text-[11px] font-bold text-zinc-600 hover:text-red-400 transition-colors">−</button>
              <span className="text-xs font-black tabular-nums w-6 text-center" style={{ color: lifeColor(opp.life) }}>{opp.life}</span>
              <button onClick={() => onAdjustLife(i, +1)}
                className="w-3.5 h-3.5 flex items-center justify-center text-[11px] font-bold text-zinc-600 hover:text-green-400 transition-colors">+</button>
              {/* Commander damage inline chips */}
              {commanders.map(cmd => {
                const dmg = opp.cmdDamage[cmd.name] ?? 0
                const lethal = dmg >= 21
                if (dmg === 0 && commanders.length > 1) return null
                return (
                  <div key={cmd.name} className="flex items-center gap-px ml-1 rounded px-1 py-0.5"
                    style={{
                      background: lethal ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${lethal ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.07)"}`,
                    }}>
                    <span className="text-[7px] text-zinc-600 mr-0.5" title={cmd.name}>⚔</span>
                    <button onClick={() => onAdjustCmdDamage(i, cmd.name, -1)} disabled={dmg === 0}
                      className="w-3 h-3 flex items-center justify-center text-[10px] text-zinc-600 hover:text-white disabled:opacity-20">−</button>
                    <span className="text-[9px] font-black tabular-nums w-3 text-center"
                      style={{ color: lethal ? "#ef4444" : dmg > 0 ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>{dmg}</span>
                    <button onClick={() => onAdjustCmdDamage(i, cmd.name, +1)}
                      className="w-3 h-3 flex items-center justify-center text-[10px] text-zinc-600 hover:text-white">+</button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── PlayerSidePanel ───────────────────────────────────────────────────────────
const SIDE_COUNTERS = [
  { key: "poison",     icon: "☠",  color: "#4ade80", label: "Poison",     warn: 10 },
  { key: "energy",     icon: "⚡", color: "#facc15", label: "Energy",     warn: 0  },
  { key: "experience", icon: "✦",  color: "#c084fc", label: "Experience", warn: 0  },
  { key: "storm",      icon: "#",  color: "#94a3b8", label: "Storm",      warn: 0  },
] as const

function PlayerSidePanel({ playerCounters, opponents, monarch, initiative, onAdjustCounter, onSetMonarch, onSetInitiative }: {
  playerCounters: Record<string, number>
  opponents: Opponent[]
  monarch: StatusHolder
  initiative: StatusHolder
  onAdjustCounter: (key: string, delta: number) => void
  onSetMonarch: (h: StatusHolder) => void
  onSetInitiative: (h: StatusHolder) => void
}) {
  const [openMenu, setOpenMenu] = useState<"monarch" | "initiative" | null>(null)

  const players: { label: string; value: StatusHolder }[] = [
    { label: "You", value: "self" },
    ...opponents.map((o, i) => ({ label: o.name, value: i as StatusHolder })),
    { label: "Nobody", value: null },
  ]

  const holderLabel = (h: StatusHolder) => {
    if (h === null) return null
    if (h === "self") return "You"
    return opponents[h as number]?.name ?? `P${(h as number) + 2}`
  }

  return (
    <div className="select-none w-full rounded-xl shadow-2xl overflow-visible"
      style={{ background: "rgba(8,8,18,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mr-1.5">Status</span>

        {/* Counter chips */}
        {SIDE_COUNTERS.map(({ key, icon, color, label, warn }) => {
          const val = playerCounters[key] ?? 0
          const isWarn = warn > 0 && val >= warn
          return (
            <div key={key} className="flex items-center gap-px px-1.5 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-[11px] leading-none" style={{ color: val > 0 ? color : "rgba(255,255,255,0.2)" }}>{icon}</span>
              <span className="text-[9px] text-zinc-500 leading-none mx-1">{label}</span>
              <button onClick={() => onAdjustCounter(key, -1)} disabled={val === 0}
                className="w-3.5 h-3.5 flex items-center justify-center text-[11px] font-bold text-zinc-600 hover:text-white disabled:opacity-25 transition-colors">−</button>
              <span className="text-[10px] font-bold tabular-nums w-4 text-center"
                style={{ color: isWarn ? "#ef4444" : val > 0 ? color : "rgba(255,255,255,0.22)" }}>{val}</span>
              <button onClick={() => onAdjustCounter(key, +1)}
                className="w-3.5 h-3.5 flex items-center justify-center text-[11px] font-bold text-zinc-600 hover:text-white transition-colors">+</button>
            </div>
          )
        })}

        {/* Divider */}
        <div className="w-px h-4 mx-0.5" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* Monarch / Initiative chips */}
        {(["monarch", "initiative"] as const).map(type => {
          const holder = type === "monarch" ? monarch : initiative
          const onSet = type === "monarch" ? onSetMonarch : onSetInitiative
          const icon = type === "monarch" ? "👑" : "⚔️"
          const active = holder !== null
          const label = holderLabel(holder)
          return (
            <div key={type} className="relative">
              <button
                onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === type ? null : type) }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                style={{
                  background: active ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.07)"}`,
                }}>
                <span className="text-[11px] leading-none">{icon}</span>
                <span className="text-[9px] font-semibold max-w-[48px] truncate"
                  style={{ color: active ? "#fbbf24" : "rgba(255,255,255,0.28)" }}>
                  {active ? label : (type === "monarch" ? "Monarch" : "Initiative")}
                </span>
                <span className="text-[8px] text-zinc-700">▾</span>
              </button>
              {openMenu === type && (
                <div className="absolute bottom-full mb-1 left-0 rounded-xl shadow-2xl overflow-hidden py-1"
                  style={{ zIndex: 100, background: "#111118", border: "1px solid rgba(255,255,255,0.1)", minWidth: 130 }}>
                  {players.map(p => (
                    <button key={String(p.value)}
                      onClick={e => { e.stopPropagation(); onSet(p.value); setOpenMenu(null) }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.07] transition-colors flex items-center gap-2"
                      style={{ color: holder === p.value ? "#fbbf24" : "#d4d4d8" }}>
                      {holder === p.value && <span className="text-[8px]">✓</span>}
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── StatusPanel (Monarch / Initiative) ────────────────────────────────────────
function StatusPanel({ monarch, initiative, opponents, onSetMonarch, onSetInitiative }: {
  monarch: StatusHolder
  initiative: StatusHolder
  opponents: Opponent[]
  onSetMonarch: (h: StatusHolder) => void
  onSetInitiative: (h: StatusHolder) => void
}) {
  const [openMenu, setOpenMenu] = useState<"monarch" | "initiative" | null>(null)

  const holderLabel = (h: StatusHolder) => {
    if (h === null) return null
    if (h === "self") return "You"
    return opponents[h as number]?.name ?? `P${(h as number) + 2}`
  }

  const players: { label: string; value: StatusHolder }[] = [
    { label: "You", value: "self" },
    ...opponents.map((o, i) => ({ label: o.name, value: i as StatusHolder })),
    { label: "Nobody", value: null },
  ]

  const StatusBadge = ({ type, holder, onSet }: {
    type: "monarch" | "initiative"
    holder: StatusHolder
    onSet: (h: StatusHolder) => void
  }) => {
    const icon = type === "monarch" ? "👑" : "⚔️"
    const label = holderLabel(holder)
    const active = holder !== null
    return (
      <div className="relative">
        <button
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === type ? null : type) }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
          style={{
            background: active ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${active ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
          }}>
          <span className="text-[11px]">{icon}</span>
          {active ? (
            <span className="text-[9px] font-bold text-amber-300">{label}</span>
          ) : (
            <span className="text-[9px] text-zinc-600">{type === "monarch" ? "Monarch" : "Initiative"}</span>
          )}
        </button>
        {openMenu === type && (
          <div className="absolute bottom-full mb-1 left-0 rounded-xl shadow-2xl overflow-hidden py-1 z-50"
            style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", minWidth: 120 }}>
            {players.map(p => (
              <button key={String(p.value)} onClick={e => { e.stopPropagation(); onSet(p.value); setOpenMenu(null) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.07] transition-colors flex items-center gap-2"
                style={{ color: holder === p.value ? "#fbbf24" : "#d4d4d8" }}>
                {holder === p.value && <span className="text-[8px]">✓</span>}
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="absolute flex gap-1.5 select-none"
      style={{ bottom: 160, left: 16, zIndex: 10 }}
      onClick={e => e.stopPropagation()}>
      <StatusBadge type="monarch" holder={monarch} onSet={onSetMonarch} />
      <StatusBadge type="initiative" holder={initiative} onSet={onSetInitiative} />
    </div>
  )
}

// ── CustomCounterModal ────────────────────────────────────────────────────────
const QUICK_COUNTERS = [
  "+1/+1", "-1/-1", "+2/+2", "charge", "shield", "oil", "stun", "time",
  "spore", "lore", "level", "age", "fade", "depletion", "blood", "blaze",
  "doom", "finality", "ice", "luck", "plague", "rust", "slime", "wound",
]

function CustomCounterModal({ existingCounters, onAdd, onClose }: {
  existingCounters: Record<string, number>
  onAdd: (name: string) => void
  onClose: () => void
}) {
  const [input, setInput] = useState("")
  const trimmed = input.trim().toLowerCase()
  const filtered = QUICK_COUNTERS.filter(c =>
    !existingCounters[c] && (!trimmed || c.includes(trimmed))
  )

  const submit = (name: string) => {
    if (!name.trim()) return
    onAdd(name.trim().toLowerCase())
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)" }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)", width: 320 }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-sm font-bold text-zinc-200">Add Counter</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(trimmed || input) }}
            placeholder="Counter name (e.g. charge, oil, doom…)"
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
          />
        </div>

        {/* Quick picks */}
        <div className="px-4 pb-3">
          <p className="text-[8px] uppercase tracking-widest text-zinc-700 mb-1.5">Quick pick</p>
          <div className="flex flex-wrap gap-1">
            {filtered.slice(0, 20).map(c => (
              <button key={c} onClick={() => submit(c)}
                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-zinc-400 hover:text-white transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: COUNTER_DEFS.find(d => d.name === c)?.color ?? "#a1a1aa",
                }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4">
          <button onClick={() => submit(trimmed || input)} disabled={!input.trim()}
            className="w-full py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-30"
            style={{ background: "rgba(99,102,241,0.22)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.35)" }}>
            Add Counter
          </button>
        </div>
      </div>
    </div>
  )
}

// ── RevealModal ───────────────────────────────────────────────────────────────
function RevealModal({ card, onDraw, onBottom, onGY, onExile, onClose }: {
  card: CardInDeck
  onDraw: () => void
  onBottom: () => void
  onGY: () => void
  onExile: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)" }} onClick={onClose}>
      <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>

        {/* Label */}
        <div className="flex items-center gap-2">
          <div className="h-px w-12" style={{ background: "rgba(255,255,255,0.12)" }} />
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Top of Library</span>
          <div className="h-px w-12" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Card image */}
        <div className="relative" style={{ width: 220, height: Math.round(220 * 88 / 63) }}>
          {card.imageUri ? (
            <img src={card.imageUri} alt={card.name} draggable={false}
              className="w-full h-full rounded-2xl shadow-2xl"
              style={{ objectFit: "cover", objectPosition: "top" }} />
          ) : (
            <div className="w-full h-full rounded-2xl flex items-center justify-center text-sm text-zinc-400 text-center p-4"
              style={{ background: tokenBg(card.colorIdentity), border: `2px solid ${tokenBorderColor(card.colorIdentity)}` }}>
              {card.name}
            </div>
          )}
        </div>

        {/* Card name */}
        <p className="text-sm font-semibold text-zinc-300">{card.name}</p>

        {/* Action buttons */}
        <div className="flex gap-2">
          {[
            { label: "Draw",       action: onDraw,   bg: "rgba(34,197,94,0.18)",   border: "rgba(34,197,94,0.4)",   color: "#86efac" },
            { label: "Put Bottom", action: onBottom, bg: "rgba(99,102,241,0.18)",  border: "rgba(99,102,241,0.4)",  color: "#a5b4fc" },
            { label: "Graveyard",  action: onGY,     bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.35)",  color: "#fca5a5" },
            { label: "Exile",      action: onExile,  bg: "rgba(139,92,246,0.18)",  border: "rgba(139,92,246,0.4)",  color: "#c4b5fd" },
          ].map(({ label, action, bg, border, color }) => (
            <button key={label} onClick={action}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
              style={{ background: bg, border: `1px solid ${border}`, color }}>
              {label}
            </button>
          ))}
        </div>

        <button onClick={onClose}
          className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors mt-1">
          Keep on top (close)
        </button>
      </div>
    </div>
  )
}
