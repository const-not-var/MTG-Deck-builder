"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  Copy, Check, Loader2, Users, Play, Crown, ArrowLeft,
  Send, X, Shuffle, BookOpen, Flame, Sparkles, Eye,
} from "lucide-react"
import type { GameState, PlayerState, GameCard, GameAction, GamePhase, Zone } from "@/types/game"

// ── Constants ─────────────────────────────────────────────────────────────────
const PHASES: { id: GamePhase; label: string; short: string; color: string }[] = [
  { id: "untap",  label: "Untap",  short: "UT", color: "#6366f1" },
  { id: "upkeep", label: "Upkeep", short: "UP", color: "#8b5cf6" },
  { id: "draw",   label: "Draw",   short: "DR", color: "#3b82f6" },
  { id: "main1",  label: "Main 1", short: "M1", color: "#22c55e" },
  { id: "combat", label: "Combat", short: "CM", color: "#ef4444" },
  { id: "main2",  label: "Main 2", short: "M2", color: "#16a34a" },
  { id: "end",    label: "End",    short: "EN", color: "#f59e0b" },
]
const SEAT_COLORS = ["#f59e0b", "#38bdf8", "#f87171", "#4ade80"]
const W = 88
const H = Math.round(W * 88 / 63)
const ZW = 78, ZH = 109
const CARD_BACK_URL = "https://cards.scryfall.io/normal/back/59/7b/597b79b3-7d77-4261-871a-60dd17403388.jpg"

const TOKEN_PRESETS: { name: string; colors: string[]; typeLine: string }[] = [
  { name: "Treasure",    colors: [],      typeLine: "Token Artifact"                    },
  { name: "Clue",        colors: [],      typeLine: "Token Artifact"                    },
  { name: "Food",        colors: [],      typeLine: "Token Artifact"                    },
  { name: "Blood",       colors: [],      typeLine: "Token Artifact"                    },
  { name: "Map",         colors: [],      typeLine: "Token Artifact"                    },
  { name: "1/1 Soldier", colors: ["W"],   typeLine: "Token Creature — Soldier"          },
  { name: "1/1 Spirit",  colors: ["W"],   typeLine: "Token Creature — Spirit"           },
  { name: "2/2 Knight",  colors: ["W"],   typeLine: "Token Creature — Knight"           },
  { name: "1/1 Elf",     colors: ["G"],   typeLine: "Token Creature — Elf"              },
  { name: "3/3 Beast",   colors: ["G"],   typeLine: "Token Creature — Beast"            },
  { name: "2/2 Wolf",    colors: ["G"],   typeLine: "Token Creature — Wolf"             },
  { name: "2/2 Zombie",  colors: ["B"],   typeLine: "Token Creature — Zombie"           },
  { name: "1/1 Goblin",  colors: ["R"],   typeLine: "Token Creature — Goblin"           },
  { name: "1/1 Thopter", colors: ["U"],   typeLine: "Token Artifact Creature — Thopter"},
  { name: "2/2 Golem",   colors: [],      typeLine: "Token Artifact Creature — Golem"  },
]
const TOKEN_COLOR_HEX: Record<string, string> = { W: "#d4b848", U: "#4a7fbf", B: "#9b59b6", R: "#e74c3c", G: "#2ecc71" }
const TOKEN_BG_MAP: Record<string, string>     = { W: "#7a6830", U: "#1a3a6e", B: "#2a1040", R: "#6e1a0a", G: "#1a4a1a" }
const TOKEN_BD_MAP: Record<string, string>     = { W: "rgba(210,190,100,0.55)", U: "rgba(60,110,200,0.55)", B: "rgba(130,60,190,0.55)", R: "rgba(200,70,40,0.55)", G: "rgba(50,170,60,0.55)" }

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function findFreePos(existing: {x:number;y:number}[], placed: {x:number;y:number}[], bfW: number, bfH: number) {
  const PAD = 10, SX = W + PAD, SY = H + PAD
  const cx = Math.max(0, Math.round(bfW / 2 - W / 2))
  const cy = Math.max(0, Math.round(bfH / 2 - H / 2))
  const all = [...existing, ...placed]
  const hit = (x: number, y: number) => all.some(e => Math.abs(e.x - x) < W + PAD && Math.abs(e.y - y) < H + PAD)
  if (!hit(cx, cy)) return { x: cx, y: cy }
  for (let r = 1; r <= 12; r++) {
    for (let c = -r; c <= r; c++) {
      for (let rw = -r; rw <= r; rw++) {
        if (Math.abs(c) !== r && Math.abs(rw) !== r) continue
        const x = Math.max(0, cx + c * SX)
        const y = Math.max(0, cy + rw * SY)
        if (!hit(x, y)) return { x, y }
      }
    }
  }
  return { x: cx, y: cy }
}

function tokenBg(colors: string[]): string {
  if (!colors.length) return "linear-gradient(145deg,#2e2e3e,#1a1a2a)"
  if (colors.length >= 2) return "linear-gradient(145deg,#4a3a10,#2a2008)"
  return `linear-gradient(145deg,${TOKEN_BG_MAP[colors[0]] ?? "#2e2e3e"},#0a0a12)`
}
function tokenBd(colors: string[]): string {
  if (!colors.length) return "rgba(110,110,130,0.4)"
  if (colors.length >= 2) return "rgba(200,170,70,0.5)"
  return TOKEN_BD_MAP[colors[0]] ?? "rgba(110,110,130,0.4)"
}

const over = (r: DOMRect | null | undefined, cx: number, cy: number) =>
  r != null && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom

// ── MiniCard ──────────────────────────────────────────────────────────────────
function MiniCard({ card, onClick, onContextMenu, dimmed, size = "md" }: {
  card: GameCard; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void
  dimmed?: boolean; size?: "sm" | "md" | "lg"
}) {
  const w = size === "sm" ? 42 : size === "lg" ? 96 : W
  const h = size === "sm" ? 59 : size === "lg" ? 134 : H
  return (
    <div className="relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl"
      style={{ width: w, height: h, opacity: dimmed ? 0.45 : 1, transform: card.tapped ? "rotate(90deg)" : undefined,
        border: card.tapped ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.1)" }}
      onClick={onClick} onContextMenu={onContextMenu}>
      {card.imageUri ? (
        <img src={card.imageUri} alt={card.name} className="w-full h-full object-cover object-top" loading="lazy" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center gap-0.5"
          style={{ background: tokenBg(card.colorIdentity), border: `1.5px solid ${tokenBd(card.colorIdentity)}` }}>
          <span className="text-[7px] font-bold text-white/90 leading-tight">{card.name}</span>
          {card.typeLine && <span className="text-[6px] text-white/40 leading-none">{card.typeLine.replace(/^Token\s*/i, "")}</span>}
        </div>
      )}
      {Object.entries(card.counters).filter(([, v]) => v > 0).map(([n, v]) => (
        <div key={n} className="absolute top-0.5 right-0.5 text-[7px] font-black px-0.5 rounded-full leading-none py-0.5"
          style={{ background: "#22c55e", color: "#fff" }}>{n.slice(0,2)}×{v}</div>
      ))}
    </div>
  )
}

// ── LifeCounter ───────────────────────────────────────────────────────────────
function LifeCounter({ life, seat, onAdjust }: { life: number; seat: number; onAdjust: (d: number) => void }) {
  const color = life <= 5 ? "#ef4444" : life <= 10 ? "#f97316" : SEAT_COLORS[seat % 4]
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onAdjust(-1)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.08] font-bold transition-colors text-lg">−</button>
      <span className="text-2xl font-black tabular-nums w-10 text-center leading-none" style={{ color }}>{life}</span>
      <button onClick={() => onAdjust(+1)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-green-400 hover:bg-white/[0.08] font-bold transition-colors text-lg">+</button>
    </div>
  )
}

// ── OpponentBar ───────────────────────────────────────────────────────────────
function OpponentBar({ player, mySeat, myCommanders, onAdjustLife, onRecordCmdDmg }: {
  player: PlayerState; mySeat: number; myCommanders: GameCard[]
  onAdjustLife: (d: number) => void
  onRecordCmdDmg: (fromSeat: number, amount: number) => void
}) {
  const seatColor = SEAT_COLORS[player.seatIndex % 4]
  const counts = [
    { label: `${player.libraryCount}L`, color: "#818cf8" },
    { label: `${player.hand.length}H`,  color: "#94a3b8" },
    { label: `${player.graveyard.length}GY`, color: "#f87171" },
    { label: `${player.exile.length}Ex`,     color: "#a78bfa" },
    { label: `${player.battlefield.length}BF`, color: "#4ade80" },
  ]
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl flex-1 min-w-0"
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${seatColor}22` }}>
      {/* Row 1: name / life / zone counts */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seatColor }} />
        <span className="text-xs font-bold text-zinc-200 truncate flex-1 min-w-0">
          {player.life <= 0 ? "💀 " : ""}{player.userName}
        </span>
        <LifeCounter life={player.life} seat={player.seatIndex} onAdjust={onAdjustLife} />
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {counts.map(({ label, color }) => (
            <span key={label} className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
              style={{ color, background: `${color}18`, border: `1px solid ${color}28` }}>{label}</span>
          ))}
        </div>
      </div>
      {/* Row 2: commanders + damage */}
      {(player.commandZone.length > 0 || myCommanders.length > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {player.commandZone.map(c => (
            c.imageUri ? (
              <img key={c.instanceId} src={c.imageUri} alt={c.name}
                className="rounded object-cover object-top flex-shrink-0"
                style={{ width: 28, height: 39, border: "1px solid rgba(245,158,11,0.3)" }} />
            ) : (
              <div key={c.instanceId} className="rounded flex items-center justify-center flex-shrink-0"
                style={{ width: 28, height: 39, background: "#1a1a2e", border: "1px solid rgba(245,158,11,0.3)" }}>
                <Crown className="w-3 h-3 text-amber-400/60" />
              </div>
            )
          ))}
          {myCommanders.map(cmd => {
            const dmg = player.commanderDamage?.[String(mySeat)] ?? 0
            const lethal = dmg >= 21
            return (
              <div key={cmd.instanceId} className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg"
                style={{ background: lethal ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${lethal ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.07)"}` }}>
                <Crown className="w-2.5 h-2.5 text-amber-400/50 flex-shrink-0" />
                <button onClick={() => onRecordCmdDmg(mySeat, -1)} disabled={dmg === 0}
                  className="text-[10px] text-zinc-600 hover:text-white disabled:opacity-20 w-3 h-3 flex items-center justify-center">−</button>
                <span className="text-[10px] font-black tabular-nums w-4 text-center"
                  style={{ color: lethal ? "#ef4444" : dmg > 0 ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>{dmg}</span>
                <button onClick={() => onRecordCmdDmg(mySeat, 1)}
                  className="text-[10px] text-zinc-600 hover:text-white w-3 h-3 flex items-center justify-center">+</button>
              </div>
            )
          })}
        </div>
      )}
      {/* Row 3: opponent BF mini preview */}
      {player.battlefield.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {player.battlefield.slice(0, 14).map(c => (
            <MiniCard key={c.instanceId} card={c} size="sm" dimmed={c.tapped} />
          ))}
          {player.battlefield.length > 14 && (
            <span className="text-[9px] text-zinc-600 self-center">+{player.battlefield.length - 14}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────
function ChatPanel({ messages, onSend }: {
  messages: { seatIndex: number; userName: string; text: string; ts: number }[]
  onSend: (text: string) => void
}) {
  const [input, setInput] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [messages])
  const send = () => { const t = input.trim(); if (!t) return; onSend(t); setInput("") }
  return (
    <div className="flex flex-col h-full" style={{ background: "rgba(6,7,22,0.95)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="px-3 py-2 border-b border-white/[0.05] flex-shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Chat</p>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ scrollbarWidth: "thin" }}>
        {messages.length === 0 && <p className="text-[10px] text-zinc-700 text-center pt-4">No messages yet</p>}
        {messages.map((m, i) => (
          <div key={i}>
            <span className="text-[10px] font-bold" style={{ color: SEAT_COLORS[m.seatIndex % 4] }}>{m.userName}: </span>
            <span className="text-[11px] text-zinc-300">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="px-2 py-2 border-t border-white/[0.05] flex gap-1.5 flex-shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/40" />
        <button onClick={send} disabled={!input.trim()}
          className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── ZoneModal ─────────────────────────────────────────────────────────────────
function ZoneModal({ title, icon, cards, emptyText, onClose, onAction, extraActions }: {
  title: string; icon: React.ReactNode; cards: GameCard[]; emptyText: string
  onClose: () => void; onAction: (a: GameAction) => void; extraActions?: React.ReactNode
}) {
  const [ctx, setCtx] = useState<{ card: GameCard; x: number; y: number; zone: Zone } | null>(null)
  const zone: Zone = title.toLowerCase().includes("grave") ? "graveyard"
    : title.toLowerCase().includes("exile") ? "exile"
    : title.toLowerCase().includes("librar") ? "library"
    : "hand"

  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center pb-4 px-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={() => { setCtx(null); onClose() }}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d0e20", border: "1px solid rgba(255,255,255,0.09)", maxHeight: "70vh" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-bold text-zinc-200">{title}</span>
            <span className="text-xs text-zinc-600">({cards.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {extraActions}
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(70vh - 56px)", scrollbarWidth: "thin" }}>
          {cards.length === 0 ? (
            <p className="text-xs text-zinc-700 text-center py-8">{emptyText}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cards.map((card, i) => (
                <div key={card.instanceId} className="relative group">
                  <MiniCard card={card} size="lg"
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ card, x: e.clientX, y: e.clientY, zone }) }}
                    onClick={() => setCtx({ card, x: 0, y: 0, zone })} />
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
                    <span className="text-[8px] text-zinc-300 truncate block px-1">{card.name}</span>
                  </div>
                  {zone === "library" && (
                    <div className="absolute top-0.5 left-0.5 bg-black/70 text-[8px] text-zinc-400 rounded px-1">{i + 1}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {ctx && (
        <div className="fixed z-[500] py-1 rounded-xl shadow-2xl"
          style={{
            left: ctx.x > 0 ? clamp(ctx.x, 0, window.innerWidth - 200) : "50%",
            top: ctx.x > 0 ? clamp(ctx.y, 0, window.innerHeight - 260) : "50%",
            transform: ctx.x === 0 ? "translate(-50%,-50%)" : undefined,
            background: "rgba(10,10,24,0.98)", border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(20px)", minWidth: 190,
          }}
          onClick={e => e.stopPropagation()}>
          <p className="px-4 py-1.5 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider truncate border-b border-white/[0.06] mb-1">{ctx.card.name}</p>
          {zone === "graveyard" && <>
            <ZoneMenuItem label="Return to Hand"       onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "graveyard", toZone: "hand" }); setCtx(null) }} />
            <ZoneMenuItem label="Put on Battlefield"   onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "graveyard", toZone: "battlefield" }); setCtx(null) }} />
            <ZoneMenuItem label="Exile"                onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "graveyard", toZone: "exile" }); setCtx(null) }} />
            <ZoneMenuItem label="Put on Top of Library" onClick={() => { onAction({ type: "MOVE_TO_TOP", instanceId: ctx.card.instanceId, fromZone: "graveyard" }); setCtx(null) }} />
          </>}
          {zone === "exile" && <>
            <ZoneMenuItem label="Return to Hand"       onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "exile", toZone: "hand" }); setCtx(null) }} />
            <ZoneMenuItem label="Put on Battlefield"   onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "exile", toZone: "battlefield" }); setCtx(null) }} />
            <ZoneMenuItem label="Send to Graveyard"    onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "exile", toZone: "graveyard" }); setCtx(null) }} />
            <ZoneMenuItem label="Put on Top of Library" onClick={() => { onAction({ type: "MOVE_TO_TOP", instanceId: ctx.card.instanceId, fromZone: "exile" }); setCtx(null) }} />
          </>}
          {zone === "library" && <>
            <ZoneMenuItem label="Draw this Card"       onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "library", toZone: "hand" }); setCtx(null) }} />
            <ZoneMenuItem label="Put on Battlefield"   onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "library", toZone: "battlefield" }); setCtx(null) }} />
            <ZoneMenuItem label="Send to Graveyard"    onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "library", toZone: "graveyard" }); setCtx(null) }} />
            <ZoneMenuItem label="Exile"                onClick={() => { onAction({ type: "MOVE", instanceId: ctx.card.instanceId, fromZone: "library", toZone: "exile" }); setCtx(null) }} />
            <ZoneMenuItem label="Put on Bottom"        onClick={() => { onAction({ type: "SCRY_BOTTOM", instanceId: ctx.card.instanceId }); setCtx(null) }} />
          </>}
        </div>
      )}
    </div>
  )
}

function ZoneMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-2 text-xs hover:bg-white/[0.07] transition-colors ${danger ? "text-red-400" : "text-zinc-200"}`}>
      {label}
    </button>
  )
}

// ── ScryModal ─────────────────────────────────────────────────────────────────
function ScryModal({ library, onBottom, onKeep, onClose }: {
  library: GameCard[]; onBottom: (id: string) => void; onKeep: () => void; onClose: () => void
}) {
  const [n, setN] = useState(1)
  const cards = library.slice(0, n)
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.80)" }} onClick={onClose}>
      <div className="rounded-2xl p-5 shadow-2xl w-full max-w-lg" style={{ background: "#0d0e20", border: "1px solid rgba(255,255,255,0.09)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-zinc-200">Scry</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setN(v => Math.max(1, v - 1))} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] font-bold text-xs flex items-center justify-center">−</button>
              <span className="text-xs text-zinc-300 w-4 text-center">{n}</span>
              <button onClick={() => setN(v => Math.min(library.length, v + 1))} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] font-bold text-xs flex items-center justify-center">+</button>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[10px] text-zinc-600 mb-3">Click a card to put it on the bottom.</p>
        <div className="flex gap-2 flex-wrap justify-center mb-4">
          {cards.map(card => (
            <div key={card.instanceId} className="relative group cursor-pointer" onClick={() => onBottom(card.instanceId)}>
              <MiniCard card={card} size="lg" />
              <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-red-500/20 transition-colors flex items-end justify-center pb-1">
                <span className="text-[9px] font-bold text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Bottom</span>
              </div>
            </div>
          ))}
          {cards.length === 0 && <p className="text-xs text-zinc-700 py-8">Library is empty</p>}
        </div>
        <button onClick={onKeep} className="w-full py-2 rounded-lg text-sm font-bold text-zinc-950 bg-amber-500 hover:bg-amber-400 transition-colors">
          Done (keep order)
        </button>
      </div>
    </div>
  )
}

// ── MillModal ─────────────────────────────────────────────────────────────────
function MillModal({ libraryCount, onMill, onClose }: { libraryCount: number; onMill: (n: number) => void; onClose: () => void }) {
  const [n, setN] = useState(1)
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.80)" }} onClick={onClose}>
      <div className="rounded-2xl p-5 shadow-2xl" style={{ background: "#0d0e20", border: "1px solid rgba(255,255,255,0.09)", minWidth: 260 }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-zinc-200">Mill</span>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center justify-center gap-3 mb-5">
          <button onClick={() => setN(v => Math.max(1, v - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] font-bold text-lg transition-colors">−</button>
          <span className="text-3xl font-black text-white w-12 text-center">{n}</span>
          <button onClick={() => setN(v => Math.min(libraryCount, v + 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] font-bold text-lg transition-colors">+</button>
        </div>
        <p className="text-[10px] text-zinc-600 text-center mb-4">Move top {n} card{n !== 1 ? "s" : ""} to graveyard</p>
        <button onClick={() => { onMill(n); onClose() }}
          className="w-full py-2 rounded-lg text-sm font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors">
          Mill {n}
        </button>
      </div>
    </div>
  )
}

// ── TokenCreator ──────────────────────────────────────────────────────────────
function TokenCreator({ onCreate, onClose }: {
  onCreate: (name: string, colors: string[], typeLine: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [colors, setColors] = useState<string[]>([])
  const [typeLine, setTypeLine] = useState("Token Creature")

  const toggleColor = (c: string) =>
    setColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const presetBg = (p: typeof TOKEN_PRESETS[0]) => {
    if (!p.colors.length) return "rgba(100,100,120,0.15)"
    if (p.colors.length >= 2) return "rgba(180,150,50,0.15)"
    return `${TOKEN_COLOR_HEX[p.colors[0]]}22`
  }
  const presetBd = (p: typeof TOKEN_PRESETS[0]) => {
    if (!p.colors.length) return "rgba(100,100,120,0.25)"
    if (p.colors.length >= 2) return "rgba(180,150,50,0.30)"
    return `${TOKEN_COLOR_HEX[p.colors[0]]}44`
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)", width: 380, maxHeight: "82vh" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-sm font-bold text-zinc-200">Create Token</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="px-4 pt-3 pb-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">Quick Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {TOKEN_PRESETS.map(p => (
                <button key={p.name}
                  onClick={() => { onCreate(p.name, p.colors, p.typeLine); onClose() }}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                  style={{ background: presetBg(p), border: `1px solid ${presetBd(p)}` }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] uppercase tracking-widest text-zinc-600">Custom Token</p>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && name.trim()) { onCreate(name.trim(), colors, typeLine); onClose() } }}
              placeholder='e.g. "3/3 Beast" or "Treasure"' autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }} />

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
                      background: colors.includes(c) ? TOKEN_COLOR_HEX[c] : "rgba(255,255,255,0.06)",
                      color: colors.includes(c) ? (c === "W" ? "#000" : "#fff") : "#71717a",
                      border: `1.5px solid ${colors.includes(c) ? TOKEN_COLOR_HEX[c] : "rgba(255,255,255,0.12)"}`,
                      boxShadow: colors.includes(c) ? `0 0 8px ${TOKEN_COLOR_HEX[c]}55` : "none",
                    }}>{c}</button>
                ))}
                {colors.length > 0 && (
                  <button onClick={() => setColors([])} className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors">clear</button>
                )}
              </div>
            </div>

            <button onClick={() => { if (name.trim()) { onCreate(name.trim(), colors, typeLine); onClose() } }}
              disabled={!name.trim()}
              className="py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-30"
              style={{ background: "rgba(99,102,241,0.22)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.35)" }}>
              Create Token
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CardContextMenu ───────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; instanceId: string; zone: Zone }

function CardContextMenu({ menu, myPlayer, onAction, onClose, onZoom }: {
  menu: CtxMenu; myPlayer: PlayerState; onAction: (a: GameAction) => void
  onClose: () => void; onZoom: (uri: string) => void
}) {
  const allCards = [...myPlayer.hand, ...myPlayer.battlefield, ...myPlayer.graveyard, ...myPlayer.exile, ...myPlayer.commandZone, ...myPlayer.library]
  const card = allCards.find(c => c.instanceId === menu.instanceId)
  if (!card) return null

  const move = (to: Zone) => { onAction({ type: "MOVE", instanceId: menu.instanceId, fromZone: menu.zone, toZone: to }); onClose() }
  const toTop = () => { onAction({ type: "MOVE_TO_TOP", instanceId: menu.instanceId, fromZone: menu.zone }); onClose() }
  const addCounter = (name: string, delta: number) => { onAction({ type: "ADD_COUNTER", instanceId: menu.instanceId, counterName: name, delta }); onClose() }
  const isCommander = /legendary.*creature|planeswalker/i.test(card.typeLine)

  return (
    <div className="fixed z-[300] py-1 rounded-xl shadow-2xl"
      style={{
        left: clamp(menu.x, 0, window.innerWidth - 210),
        top: clamp(menu.y, 0, window.innerHeight - 340),
        background: "rgba(10,10,24,0.98)", border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)", minWidth: 200,
      }}
      onClick={e => e.stopPropagation()}>
      <p className="px-4 py-1.5 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider truncate border-b border-white/[0.06] mb-1">{card.name}</p>

      {card.imageUri && <ZoneMenuItem label="Zoom" onClick={() => { onZoom(card.imageUri); onClose() }} />}

      {menu.zone === "hand" && <>
        <ZoneMenuItem label="Play to Battlefield" onClick={() => move("battlefield")} />
        <ZoneMenuItem label="Discard (Graveyard)" onClick={() => move("graveyard")} />
        <ZoneMenuItem label="Exile"               onClick={() => move("exile")} />
        <ZoneMenuItem label="Put on Top of Library" onClick={toTop} />
      </>}

      {menu.zone === "battlefield" && <>
        <ZoneMenuItem label={card.tapped ? "Untap" : "Tap"} onClick={() => { onAction({ type: "TAP", instanceId: menu.instanceId }); onClose() }} />
        <div className="h-px mx-3 my-1 bg-white/[0.06]" />
        <ZoneMenuItem label="Return to Hand"        onClick={() => move("hand")} />
        <ZoneMenuItem label="Send to Graveyard"     onClick={() => move("graveyard")} />
        <ZoneMenuItem label="Exile"                 onClick={() => move("exile")} />
        <ZoneMenuItem label="Put on Top of Library" onClick={toTop} />
        {isCommander && <ZoneMenuItem label="Return to Command Zone" onClick={() => move("commandZone")} />}
        <div className="h-px mx-3 my-1 bg-white/[0.06]" />
        <ZoneMenuItem label="+1/+1 counter"   onClick={() => addCounter("+1/+1", 1)} />
        <ZoneMenuItem label="Remove +1/+1"    onClick={() => addCounter("+1/+1", -1)} />
        <ZoneMenuItem label="-1/-1 counter"   onClick={() => addCounter("-1/-1", 1)} />
        <ZoneMenuItem label="Charge counter"  onClick={() => addCounter("charge", 1)} />
        <ZoneMenuItem label="Loyalty +1"      onClick={() => addCounter("loyalty", 1)} />
        <ZoneMenuItem label="Loyalty −1"      onClick={() => addCounter("loyalty", -1)} />
        <ZoneMenuItem label="Loyalty −2"      onClick={() => addCounter("loyalty", -2)} />
        <ZoneMenuItem label="Loyalty −3"      onClick={() => addCounter("loyalty", -3)} />
      </>}

      {menu.zone === "graveyard" && <>
        <ZoneMenuItem label="Return to Hand"        onClick={() => move("hand")} />
        <ZoneMenuItem label="Put on Battlefield"    onClick={() => move("battlefield")} />
        <ZoneMenuItem label="Exile"                 onClick={() => move("exile")} />
        <ZoneMenuItem label="Put on Top of Library" onClick={toTop} />
      </>}

      {menu.zone === "exile" && <>
        <ZoneMenuItem label="Return to Hand"        onClick={() => move("hand")} />
        <ZoneMenuItem label="Put on Battlefield"    onClick={() => move("battlefield")} />
        <ZoneMenuItem label="Send to Graveyard"     onClick={() => move("graveyard")} />
        <ZoneMenuItem label="Put on Top of Library" onClick={toTop} />
      </>}

      {menu.zone === "commandZone" && <>
        <ZoneMenuItem label="Cast (Battlefield)"    onClick={() => { onAction({ type: "CAST_COMMANDER", instanceId: menu.instanceId }); onClose() }} />
        <ZoneMenuItem label="Put in Hand"           onClick={() => move("hand")} />
      </>}
    </div>
  )
}

// ── Main GameClient ───────────────────────────────────────────────────────────
interface Props { code: string; userId: string; userName: string }

export function GameClient({ code, userId, userName }: Props) {
  const router = useRouter()
  const [game, setGame] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const [showGY, setShowGY] = useState(false)
  const [showExile, setShowExile] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showScry, setShowScry] = useState(false)
  const [showMill, setShowMill] = useState(false)
  const [showTokenCreator, setShowTokenCreator] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Free-floating BF positions: instanceId → {x, y}
  const [bfPositions, setBfPositions] = useState<Record<string, { x: number; y: number }>>({})

  // Drag
  const [handDrag, setHandDrag] = useState<{ card: GameCard; x: number; y: number } | null>(null)
  const [cmdDrag, setCmdDrag] = useState<{ card: GameCard; x: number; y: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<"graveyard" | "exile" | "hand" | "commandZone" | "battlefield" | null>(null)

  // Refs
  const bfRef      = useRef<HTMLDivElement>(null)
  const bfSizeRef  = useRef({ w: 0, h: 0 })
  const bfDrag     = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const bfClickBlocked = useRef(false)
  const gyRef      = useRef<HTMLButtonElement>(null)
  const exileRef   = useRef<HTMLButtonElement>(null)
  const handZoneRef = useRef<HTMLDivElement>(null)
  const cmdZoneRef = useRef<HTMLDivElement>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const meRef      = useRef<PlayerState | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Track BF dimensions for auto-positioning and position scaling
  useEffect(() => {
    if (!bfRef.current) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      const { w: oldW, h: oldH } = bfSizeRef.current
      if (oldW > 0 && oldH > 0 && (Math.abs(oldW - width) > 1 || Math.abs(oldH - height) > 1)) {
        const sx = width / oldW, sy = height / oldH
        setBfPositions(prev => {
          const next: typeof prev = {}
          for (const [id, pos] of Object.entries(prev)) next[id] = { x: pos.x * sx, y: pos.y * sy }
          return next
        })
      }
      bfSizeRef.current = { w: width, h: height }
    })
    obs.observe(bfRef.current)
    return () => obs.disconnect()
  }, [])

  // Polling
  const poll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/game/${code}`)
      if (res.ok) setGame((await res.json()).game)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [code])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(() => poll(true), 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [poll])

  const me = game?.players.find(p => p.userId === userId) ?? null
  meRef.current = me

  // Auto-assign BF positions for new cards, clean up removed ones
  useEffect(() => {
    if (!me) return
    const bf = me.battlefield
    const bfIds = new Set(bf.map(c => c.instanceId))
    setBfPositions(prev => {
      const next = { ...prev }
      const placed: { x: number; y: number }[] = []
      for (const card of bf) {
        if (!next[card.instanceId]) {
          const existing = Object.values(next)
          const { w, h } = bfSizeRef.current
          const pos = findFreePos(existing, placed, w || 900, h || 500)
          next[card.instanceId] = pos
          placed.push(pos)
        }
      }
      for (const id of Object.keys(next)) {
        if (!bfIds.has(id)) delete next[id]
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.battlefield])

  const dispatch = useCallback(async (action: GameAction) => {
    setGame(prev => {
      if (!prev) return prev
      const pi = prev.players.findIndex(p => p.userId === userId)
      if (pi === -1) return prev
      const player = JSON.parse(JSON.stringify(prev.players[pi]))
      let turn = { ...prev.turn }

      switch (action.type) {
        case "TAP":
          player.battlefield = player.battlefield.map((c: GameCard) =>
            c.instanceId === action.instanceId ? { ...c, tapped: !c.tapped } : c)
          break
        case "DRAW": {
          const n = Math.min(action.count ?? 1, player.library.length)
          player.hand = [...player.hand, ...player.library.splice(0, n)]
          player.libraryCount = player.library.length; break
        }
        case "UNTAP_ALL":
          player.battlefield = player.battlefield.map((c: GameCard) => ({ ...c, tapped: false })); break
        case "ADJUST_LIFE":
          player.life = Math.max(0, player.life + action.delta); break
        case "SHUFFLE":
          player.library = [...player.library].sort(() => Math.random() - 0.5); break
        case "MILL": {
          const n = Math.min(action.count, player.library.length)
          player.graveyard = [...player.graveyard, ...player.library.splice(0, n)]
          player.libraryCount = player.library.length; break
        }
        case "NEXT_PHASE": {
          const idx = PHASES.findIndex(p => p.id === prev.turn.phase)
          const nextPhase = PHASES[(idx + 1) % PHASES.length].id
          if (nextPhase === "untap") {
            const seats = prev.players.filter(p => p.joined).map(p => p.seatIndex).sort((a, b) => a - b)
            const ci = seats.indexOf(prev.turn.currentSeat)
            turn = { currentSeat: seats[(ci + 1) % seats.length], phase: "untap", number: prev.turn.number + 1 }
          } else { turn = { ...prev.turn, phase: nextPhase } }
          break
        }
        case "MOVE": {
          const zones: Record<string, GameCard[]> = {
            hand: player.hand, battlefield: player.battlefield, graveyard: player.graveyard,
            exile: player.exile, commandZone: player.commandZone, library: player.library,
          }
          const from = zones[action.fromZone]
          const idx = from.findIndex((c: GameCard) => c.instanceId === action.instanceId)
          if (idx !== -1) {
            const [card] = from.splice(idx, 1)
            zones[action.toZone] = [...zones[action.toZone], { ...card, tapped: false }]
            Object.assign(player, zones)
            player.libraryCount = player.library.length
          }
          break
        }
        case "MOVE_TO_TOP": {
          const zones: Record<string, GameCard[]> = {
            hand: player.hand, battlefield: player.battlefield, graveyard: player.graveyard,
            exile: player.exile, commandZone: player.commandZone, library: player.library,
          }
          const from = zones[action.fromZone]
          const idx = from.findIndex((c: GameCard) => c.instanceId === action.instanceId)
          if (idx !== -1) {
            const [card] = from.splice(idx, 1)
            player.library = [{ ...card, tapped: false }, ...player.library]
            player.libraryCount = player.library.length
            Object.assign(player, zones)
          }
          break
        }
        case "SCRY_BOTTOM": {
          const idx = player.library.findIndex((c: GameCard) => c.instanceId === action.instanceId)
          if (idx !== -1) {
            const [card] = player.library.splice(idx, 1)
            player.library = [...player.library, card]
          }
          break
        }
        case "ADD_COUNTER":
          player.battlefield = player.battlefield.map((c: GameCard) =>
            c.instanceId === action.instanceId
              ? { ...c, counters: { ...c.counters, [action.counterName]: Math.max(0, (c.counters[action.counterName] ?? 0) + action.delta) } }
              : c)
          break
        case "CAST_COMMANDER": {
          const idx = player.commandZone.findIndex((c: GameCard) => c.instanceId === action.instanceId)
          if (idx !== -1) {
            const [cmd] = player.commandZone.splice(idx, 1)
            player.cmdCastCount[cmd.name] = (player.cmdCastCount[cmd.name] ?? 0) + 1
            player.battlefield = [...player.battlefield, { ...cmd, tapped: false }]
          }
          break
        }
        case "CREATE_TOKEN": {
          const token: GameCard = {
            instanceId: action.instanceId, scryfallId: `token-${action.instanceId}`,
            name: action.name, imageUri: "", typeLine: action.typeLine,
            oracleText: "", manaCost: "", cmc: 0, colorIdentity: action.colorIdentity,
            tapped: false, counters: {},
          }
          player.battlefield = [...player.battlefield, token]
          break
        }
        case "RECORD_CMD_DAMAGE": {
          const key = String(action.fromSeat)
          player.commanderDamage[key] = (player.commanderDamage[key] ?? 0) + action.amount
          player.life = Math.max(0, player.life - action.amount)
          break
        }
      }
      return { ...prev, players: prev.players.map((p, i) => i === pi ? player : p), turn }
    })
    fetch(`/api/game/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {})
  }, [code, userId])

  const closeCtx = useCallback(() => setCtxMenu(null), [])

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onGlobalMouseMove = useCallback((e: React.MouseEvent) => {
    const cx = e.clientX, cy = e.clientY

    if (bfDrag.current) {
      const dx = cx - bfDrag.current.sx
      const dy = cy - bfDrag.current.sy
      if (!bfDrag.current.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        bfDrag.current.moved = true
        bfClickBlocked.current = true
      }
      if (bfDrag.current.moved) {
        const id = bfDrag.current.id
        setBfPositions(prev => ({ ...prev, [id]: { x: Math.max(0, bfDrag.current!.ox + dx), y: Math.max(0, bfDrag.current!.oy + dy) } }))
        const gy = gyRef.current?.getBoundingClientRect()
        const ex = exileRef.current?.getBoundingClientRect()
        const hz = handZoneRef.current?.getBoundingClientRect()
        const cz = cmdZoneRef.current?.getBoundingClientRect()
        const dragged = meRef.current?.battlefield.find(c => c.instanceId === id)
        const isCmd = dragged ? /legendary.*creature|planeswalker/i.test(dragged.typeLine) : false
        if (isCmd && over(cz, cx, cy)) setDropTarget("commandZone")
        else if (over(hz, cx, cy)) setDropTarget("hand")
        else if (over(gy, cx, cy)) setDropTarget("graveyard")
        else if (over(ex, cx, cy)) setDropTarget("exile")
        else setDropTarget(null)
      }
    }

    if (handDrag) {
      setHandDrag(d => d ? { ...d, x: cx, y: cy } : null)
      const gy = gyRef.current?.getBoundingClientRect()
      const ex = exileRef.current?.getBoundingClientRect()
      const bf = bfRef.current?.getBoundingClientRect()
      if (over(gy, cx, cy)) setDropTarget("graveyard")
      else if (over(ex, cx, cy)) setDropTarget("exile")
      else if (over(bf, cx, cy)) setDropTarget("battlefield")
      else setDropTarget(null)
    }

    if (cmdDrag) {
      setCmdDrag(d => d ? { ...d, x: cx, y: cy } : null)
      const bf = bfRef.current?.getBoundingClientRect()
      setDropTarget(over(bf, cx, cy) ? "battlefield" : null)
    }
  }, [handDrag, cmdDrag])

  const onGlobalMouseUp = useCallback((e: React.MouseEvent) => {
    const cx = e.clientX, cy = e.clientY

    if (bfDrag.current?.moved) {
      const id = bfDrag.current.id
      const gy = gyRef.current?.getBoundingClientRect()
      const ex = exileRef.current?.getBoundingClientRect()
      const hz = handZoneRef.current?.getBoundingClientRect()
      const cz = cmdZoneRef.current?.getBoundingClientRect()
      const dragged = meRef.current?.battlefield.find(c => c.instanceId === id)
      const isCmd = dragged ? /legendary.*creature|planeswalker/i.test(dragged.typeLine) : false
      if (isCmd && over(cz, cx, cy)) dispatch({ type: "MOVE", instanceId: id, fromZone: "battlefield", toZone: "commandZone" })
      else if (over(hz, cx, cy)) dispatch({ type: "MOVE", instanceId: id, fromZone: "battlefield", toZone: "hand" })
      else if (over(gy, cx, cy)) dispatch({ type: "MOVE", instanceId: id, fromZone: "battlefield", toZone: "graveyard" })
      else if (over(ex, cx, cy)) dispatch({ type: "MOVE", instanceId: id, fromZone: "battlefield", toZone: "exile" })
    }
    bfDrag.current = null
    setDropTarget(null)

    if (handDrag) {
      const gy = gyRef.current?.getBoundingClientRect()
      const ex = exileRef.current?.getBoundingClientRect()
      const bf = bfRef.current?.getBoundingClientRect()
      if (over(gy, cx, cy)) {
        dispatch({ type: "MOVE", instanceId: handDrag.card.instanceId, fromZone: "hand", toZone: "graveyard" })
      } else if (over(ex, cx, cy)) {
        dispatch({ type: "MOVE", instanceId: handDrag.card.instanceId, fromZone: "hand", toZone: "exile" })
      } else if (bf && over(bf, cx, cy)) {
        const x = Math.max(0, cx - bf.left - W / 2)
        const y = Math.max(0, cy - bf.top - H / 2)
        setBfPositions(prev => ({ ...prev, [handDrag.card.instanceId]: { x, y } }))
        dispatch({ type: "MOVE", instanceId: handDrag.card.instanceId, fromZone: "hand", toZone: "battlefield" })
      }
      setHandDrag(null)
    }

    if (cmdDrag) {
      const bf = bfRef.current?.getBoundingClientRect()
      if (bf && over(bf, cx, cy)) {
        const x = Math.max(0, cx - bf.left - W / 2)
        const y = Math.max(0, cy - bf.top - H / 2)
        setBfPositions(prev => ({ ...prev, [cmdDrag.card.instanceId]: { x, y } }))
        dispatch({ type: "CAST_COMMANDER", instanceId: cmdDrag.card.instanceId })
      }
      setCmdDrag(null)
      setDropTarget(null)
    }
  }, [handDrag, cmdDrag, dispatch])

  const createToken = useCallback((name: string, colors: string[], typeLine: string) => {
    const instanceId = `token-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const { w, h } = bfSizeRef.current
    setBfPositions(prev => {
      const pos = findFreePos(Object.values(prev), [], w || 900, h || 500)
      return { ...prev, [instanceId]: pos }
    })
    dispatch({ type: "CREATE_TOKEN", instanceId, name, typeLine, colorIdentity: colors })
  }, [dispatch])

  const copyCode = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const opponents = game?.players.filter(p => p.userId !== userId) ?? []
  const myCommanders = me?.commandZone.filter(c => /legendary.*creature|planeswalker/i.test(c.typeLine)) ?? []
  const isMyTurn = game?.turn.currentSeat === me?.seatIndex
  const isHost = game?.hostUserId === userId

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#06071c" }}>
      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
    </div>
  )
  if (!game) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "#06071c" }}>
      <p className="text-zinc-400">Game not found</p>
      <button onClick={() => router.push("/game")} className="text-sm text-amber-400 hover:text-amber-300">Back to lobby</button>
    </div>
  )

  // ── Lobby ──────────────────────────────────────────────────────────────────
  if (game.status === "lobby") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6" style={{ background: "#06071c" }}>
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Waiting for Players</h1>
            <p className="text-sm text-zinc-500 mt-1">Share the code below to invite friends</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <span className="text-3xl font-black tracking-[0.3em] text-amber-400 font-mono">{code}</span>
              <button onClick={copyCode} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{game.players.filter(p => p.joined).length} / {game.maxPlayers} Players</span>
            </div>
            {game.players.filter(p => p.joined).map(p => (
              <div key={p.userId} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEAT_COLORS[p.seatIndex % 4] }} />
                <span className="text-sm text-zinc-200">{p.userName}</span>
                {p.userId === game.hostUserId && <span className="text-[9px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded font-bold">HOST</span>}
                {p.userId === userId && <span className="text-[9px] text-zinc-500">(you)</span>}
              </div>
            ))}
            {game.players.filter(p => p.joined).length < 2 && <p className="text-xs text-zinc-600 mt-2">Waiting for at least one more player…</p>}
          </div>
          {isHost ? (
            <button onClick={() => dispatch({ type: "START_GAME" })}
              disabled={game.players.filter(p => p.joined).length < 2}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-40 transition-colors shadow-lg shadow-amber-500/25">
              <Play className="w-4 h-4" /> Start Game
            </button>
          ) : (
            <p className="text-center text-xs text-zinc-600">Waiting for the host to start the game…</p>
          )}
          <button onClick={() => router.push("/game")} className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Leave game</button>
        </div>
      </div>
    )
  }

  if (!me) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#06071c" }}>
      <p className="text-zinc-400">You are not in this game.</p>
    </div>
  )

  const openCtx = (e: React.MouseEvent, instanceId: string, zone: Zone) => {
    e.preventDefault(); e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, instanceId, zone })
  }

  // ── Active game ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col select-none overflow-hidden"
      style={{ background: "#07071a", cursor: (bfDrag.current || handDrag || cmdDrag) ? "grabbing" : "default" }}
      onMouseMove={onGlobalMouseMove}
      onMouseUp={onGlobalMouseUp}
      onClick={closeCtx}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 h-11 flex-shrink-0 border-b border-white/[0.05]"
        style={{ background: "rgba(6,7,28,0.98)" }}>

        <button onClick={() => router.push("/game")} className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-5 bg-white/[0.07]" />

        {/* Phase tracker */}
        <div className="flex items-center gap-0.5">
          {PHASES.map(ph => {
            const active = game.turn.phase === ph.id
            return (
              <button key={ph.id} onClick={e => { e.stopPropagation(); dispatch({ type: "NEXT_PHASE" }) }} title={ph.label}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all"
                style={{ background: active ? `${ph.color}22` : "transparent", color: active ? ph.color : "rgba(255,255,255,0.2)", border: `1px solid ${active ? ph.color : "transparent"}` }}>
                {ph.short}
              </button>
            )
          })}
          <button onClick={e => { e.stopPropagation(); dispatch({ type: "NEXT_PHASE" }) }}
            className="ml-1 w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-white/[0.08] text-xs font-bold transition-colors" title="Next phase">→</button>
        </div>
        <div className="w-px h-5 bg-white/[0.07]" />

        <span className="text-[10px] text-zinc-500 flex-shrink-0">
          T{game.turn.number} · <span style={{ color: SEAT_COLORS[game.turn.currentSeat % 4] }}>
            {game.players.find(p => p.seatIndex === game.turn.currentSeat)?.userName ?? "?"}
          </span>
          {isMyTurn && <span className="text-amber-400"> ★</span>}
        </span>

        <div className="flex-1" />

        <LifeCounter life={me.life} seat={me.seatIndex} onAdjust={d => dispatch({ type: "ADJUST_LIFE", delta: d })} />
        <div className="w-px h-5 bg-white/[0.07]" />

        <button onClick={e => { e.stopPropagation(); dispatch({ type: "DRAW" }) }}         className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Draw</button>
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "UNTAP_ALL" }) }}     className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Untap All</button>
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "SHUFFLE" }) }}       className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors flex items-center gap-1"><Shuffle className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); setShowScry(true) }}                   className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Scry</button>
        <button onClick={e => { e.stopPropagation(); setShowMill(true) }}                   className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Mill</button>
        <button onClick={e => { e.stopPropagation(); setShowTokenCreator(true) }}           className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">+ Token</button>
        <div className="w-px h-5 bg-white/[0.07]" />
        <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0">{code}</span>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: game area ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Opponents */}
          {opponents.length > 0 && (
            <div className="flex gap-2 p-2 flex-shrink-0 overflow-x-auto"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {opponents.map(opp => (
                <OpponentBar key={opp.userId} player={opp} mySeat={me.seatIndex} myCommanders={myCommanders}
                  onAdjustLife={d => setGame(prev => prev ? {
                    ...prev, players: prev.players.map(p => p.userId === opp.userId ? { ...p, life: Math.max(0, p.life + d) } : p)
                  } : prev)}
                  onRecordCmdDmg={(fromSeat, amount) => dispatch({ type: "RECORD_CMD_DAMAGE", fromSeat, amount })}
                />
              ))}
            </div>
          )}

          {/* ── Free-floating Battlefield ──────────────────────────────────── */}
          <div ref={bfRef} className="flex-1 relative overflow-hidden"
            style={{
              background: "#06070e",
              backgroundImage: [
                "radial-gradient(ellipse at 30% 40%, rgba(12,14,32,0.9) 0%, transparent 60%)",
                "radial-gradient(ellipse at 70% 60%, rgba(10,11,26,0.7) 0%, transparent 55%)",
              ].join(", "),
            }}>

            {/* Playmat */}
            <div className="absolute pointer-events-none" style={{
              left: "50%", top: "50%", transform: "translate(-50%, -50%)",
              width: "min(95%, 1200px)", height: "min(90%, 680px)",
              borderRadius: 18,
              background: "linear-gradient(150deg, #0d1028 0%, #090b20 50%, #0b0d24 100%)",
              border: "1px solid rgba(99,102,241,0.15)",
              boxShadow: "0 20px 80px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
              zIndex: 0,
            }} />

            {me.battlefield.length === 0 && me.commandZone.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1.5" style={{ zIndex: 1 }}>
                <p className="text-zinc-800 text-sm select-none">Drag cards here from your hand or command zone</p>
                <p className="text-zinc-900 text-[10px] select-none">Right-click any card for more options</p>
              </div>
            )}

            {/* Command zone — top-left of playmat */}
            {me.commandZone.length > 0 && (
              <div ref={cmdZoneRef} className="absolute flex flex-col gap-1.5"
                style={{
                  top: "calc(50% - min(45%, 340px) + 14px)",
                  left: "calc(50% - min(47.5%, 600px) + 14px)",
                  zIndex: 10, borderRadius: 10, padding: 4,
                  background: dropTarget === "commandZone" ? "rgba(245,158,11,0.15)" : "transparent",
                  transition: "background 0.15s",
                }}>
                <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500/50 pl-0.5">Command Zone</span>
                <div className="flex gap-2">
                  {me.commandZone.map(c => {
                    const castCount = me.cmdCastCount[c.name] ?? 0
                    const tax = castCount * 2
                    return (
                      <div key={c.instanceId} className="relative group" style={{ width: W, cursor: "grab" }}>
                        {c.imageUri ? (
                          <img src={c.imageUri} alt={c.name} draggable={false}
                            className="rounded-lg shadow-2xl select-none"
                            style={{ width: W, height: H, objectFit: "cover", objectPosition: "top", border: "1.5px solid rgba(245,158,11,0.5)" }}
                            onMouseDown={e => { if (e.button !== 0) return; e.preventDefault(); setCmdDrag({ card: c, x: e.clientX, y: e.clientY }) }}
                            onContextMenu={e => openCtx(e, c.instanceId, "commandZone")} />
                        ) : (
                          <div className="rounded-lg flex items-center justify-center text-[9px] text-amber-400/60 text-center p-1 select-none"
                            style={{ width: W, height: H, background: "#1a1a2e", border: "1.5px solid rgba(245,158,11,0.5)", cursor: "grab" }}
                            onMouseDown={e => { if (e.button !== 0) return; e.preventDefault(); setCmdDrag({ card: c, x: e.clientX, y: e.clientY }) }}>
                            {c.name}
                          </div>
                        )}
                        {/* Cast count */}
                        <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between pointer-events-none" style={{ zIndex: 2 }}>
                          <span className="text-[8px] font-bold rounded px-1 py-0.5"
                            style={{ background: "rgba(0,0,0,0.82)", color: castCount > 0 ? "#fbbf24" : "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            {castCount}×{tax > 0 ? ` +${tax}` : ""}
                          </span>
                        </div>
                        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 flex items-end justify-center pb-10 transition-opacity pointer-events-none"
                          style={{ background: "rgba(0,0,0,0.45)" }}>
                          <span className="text-[8px] font-semibold text-zinc-300">Drag to battlefield</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Zone stacks — bottom-right of playmat */}
            <div className="absolute flex items-end gap-3"
              style={{
                bottom: "calc(50% - min(45%, 340px) + 14px)",
                right: "calc(50% - min(47.5%, 600px) + 14px)",
                zIndex: 10,
              }}>

              {/* Exile */}
              {(() => {
                const topCard = me.exile.at(-1)
                const isTarget = dropTarget === "exile"
                return (
                  <div className="flex flex-col items-center gap-1.5">
                    <button ref={exileRef} onClick={e => { e.stopPropagation(); setShowExile(true) }}
                      className="relative group transition-transform hover:-translate-y-1" style={{ width: ZW, height: ZH }}>
                      {me.exile.length > 2 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-4px,-4px)", background: "#1a0a2e", border: "1px solid rgba(139,92,246,0.2)", zIndex: 1 }} />}
                      {me.exile.length > 1 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-2px,-2px)", background: "#1e0d35", border: "1px solid rgba(139,92,246,0.3)", zIndex: 2 }} />}
                      <div className="absolute inset-0 rounded-lg overflow-hidden"
                        style={{ zIndex: 3, border: isTarget ? "2px solid rgba(139,92,246,0.9)" : "1.5px solid rgba(139,92,246,0.5)", boxShadow: isTarget ? "0 0 28px rgba(139,92,246,0.6)" : "0 4px 24px rgba(139,92,246,0.2)", transition: "border 0.1s, box-shadow 0.1s" }}>
                        {topCard?.imageUri ? (
                          <img src={topCard.imageUri} alt="" className="w-full h-full object-cover object-top" style={{ filter: "brightness(0.5) saturate(0.7)" }} />
                        ) : (
                          <div className="w-full h-full" style={{ background: "linear-gradient(145deg,#1a0a2e,#0d0718)" }} />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: isTarget ? "rgba(139,92,246,0.22)" : "transparent", transition: "background 0.1s" }}>
                          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-400/80">Exile</span>
                          <span className="text-2xl font-black text-white tabular-nums leading-none" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{me.exile.length}</span>
                        </div>
                      </div>
                    </button>
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Exile</span>
                  </div>
                )
              })()}

              {/* Graveyard */}
              {(() => {
                const topCard = me.graveyard.at(-1)
                const isTarget = dropTarget === "graveyard"
                return (
                  <div className="flex flex-col items-center gap-1.5">
                    <button ref={gyRef} onClick={e => { e.stopPropagation(); setShowGY(true) }}
                      className="relative group transition-transform hover:-translate-y-1" style={{ width: ZW, height: ZH }}>
                      {me.graveyard.length > 2 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-4px,-4px)", background: "#2a0a0a", border: "1px solid rgba(239,68,68,0.15)", zIndex: 1 }} />}
                      {me.graveyard.length > 1 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-2px,-2px)", background: "#350d0d", border: "1px solid rgba(239,68,68,0.25)", zIndex: 2 }} />}
                      <div className="absolute inset-0 rounded-lg overflow-hidden"
                        style={{ zIndex: 3, border: isTarget ? "2px solid rgba(239,68,68,0.85)" : "1.5px solid rgba(239,68,68,0.35)", boxShadow: isTarget ? "0 0 28px rgba(239,68,68,0.55)" : "0 4px 24px rgba(239,68,68,0.15)", transition: "border 0.1s, box-shadow 0.1s" }}>
                        {topCard?.imageUri ? (
                          <img src={topCard.imageUri} alt="" className="w-full h-full object-cover object-top" style={{ filter: "brightness(0.5) saturate(0.6)" }} />
                        ) : (
                          <div className="w-full h-full" style={{ background: "linear-gradient(145deg,#2a0a0a,#150505)" }} />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: isTarget ? "rgba(239,68,68,0.22)" : "transparent", transition: "background 0.1s" }}>
                          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-red-400/80">Grave</span>
                          <span className="text-2xl font-black text-white tabular-nums leading-none" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{me.graveyard.length}</span>
                        </div>
                      </div>
                    </button>
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Graveyard</span>
                  </div>
                )
              })()}

              {/* Library */}
              {(() => {
                const count = me.libraryCount
                const empty = count === 0
                return (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="relative group/lib" style={{ width: ZW, height: ZH }}>
                      {count > 4 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-6px,-6px)", background: `url('${CARD_BACK_URL}') center/cover`, border: "1px solid rgba(44,82,152,0.35)", zIndex: 1, opacity: 0.6 }} />}
                      {count > 2 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-4px,-4px)", background: `url('${CARD_BACK_URL}') center/cover`, border: "1px solid rgba(44,82,152,0.45)", zIndex: 2, opacity: 0.75 }} />}
                      {count > 1 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-2px,-2px)", background: `url('${CARD_BACK_URL}') center/cover`, border: "1px solid rgba(44,82,152,0.55)", zIndex: 3, opacity: 0.88 }} />}
                      <button onClick={e => { e.stopPropagation(); dispatch({ type: "DRAW" }) }} disabled={empty}
                        className="absolute inset-0 rounded-lg overflow-hidden transition-transform hover:-translate-y-1 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ zIndex: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.7)" }}>
                        <img src={CARD_BACK_URL} alt="Library" className="w-full h-full object-cover" draggable={false} />
                        {!empty && (
                          <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                            <span className="text-xs font-black text-white tabular-nums px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.75)" }}>{count}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/lib:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.55)" }}>
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Draw</span>
                        </div>
                      </button>
                      <button onClick={e => { e.stopPropagation(); setShowLibrary(true) }}
                        className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover/lib:opacity-100 transition-all shadow-lg"
                        style={{ zIndex: 10, background: "#18181f", border: "1px solid rgba(255,255,255,0.18)" }}>
                        <Eye className="w-3 h-3 text-zinc-300" />
                      </button>
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Library</span>
                  </div>
                )
              })()}
            </div>

            {/* Battlefield permanents — absolutely positioned, draggable */}
            {me.battlefield.map(card => {
              const pos = bfPositions[card.instanceId] ?? { x: 0, y: 0 }
              const isDragging = bfDrag.current?.id === card.instanceId
              return (
                <div key={card.instanceId}
                  className="absolute select-none group/bfc"
                  style={{
                    left: pos.x, top: pos.y, width: W, height: H,
                    transform: card.tapped ? "rotate(90deg)" : "none",
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.18s ease",
                    cursor: isDragging ? "grabbing" : "grab",
                    zIndex: isDragging ? 200 : 40,
                    filter: card.tapped ? "brightness(0.8) saturate(0.8)" : "none",
                  }}
                  onMouseDown={e => {
                    if (e.button !== 0) return
                    e.stopPropagation()
                    bfDrag.current = { id: card.instanceId, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false }
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (bfClickBlocked.current) { bfClickBlocked.current = false; return }
                    dispatch({ type: "TAP", instanceId: card.instanceId })
                  }}
                  onContextMenu={e => openCtx(e, card.instanceId, "battlefield")}>

                  {card.imageUri ? (
                    <img src={card.imageUri} alt={card.name} draggable={false}
                      className="w-full h-full rounded-lg shadow-xl select-none"
                      style={{ objectFit: "cover", objectPosition: "top" }} />
                  ) : (
                    <div className="w-full h-full rounded-lg flex flex-col items-center justify-center p-2 text-center select-none"
                      style={{ background: tokenBg(card.colorIdentity), border: `1.5px solid ${tokenBd(card.colorIdentity)}` }}>
                      <span className="text-[10px] font-bold text-white/90 leading-snug">{card.name}</span>
                      {card.typeLine && <span className="text-[8px] text-white/40 mt-0.5 leading-none">{card.typeLine.replace(/^Token\s*/i, "")}</span>}
                    </div>
                  )}

                  {/* Counter badges */}
                  {Object.entries(card.counters).filter(([, v]) => v > 0).length > 0 && (
                    <div className="absolute -top-1 -right-1 flex flex-col items-end gap-0.5 pointer-events-none" style={{ zIndex: 2 }}>
                      {Object.entries(card.counters).filter(([, v]) => v > 0).map(([name, count]) => (
                        <div key={name} className="flex items-center gap-0.5 px-1 rounded-full text-[9px] font-black leading-none py-0.5"
                          style={{ background: "#22c55e", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
                          <span>{name.slice(0, 3)}</span><span>×{count}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {card.tapped && <div className="absolute inset-0 rounded-lg ring-1 ring-amber-500/20 pointer-events-none" />}

                  <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover/bfc:opacity-100 transition-opacity pointer-events-none rounded-b-lg overflow-hidden" style={{ zIndex: 3 }}>
                    <div className="bg-black/85 px-1.5 py-1 text-center">
                      <span className="text-[9px] text-zinc-200 leading-tight block truncate">{card.name}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Hand zone — overlaps battlefield ──────────────────────────── */}
          <div ref={handZoneRef} className="flex-shrink-0 select-none"
            style={{
              background: "#06070e",
              paddingTop: 12,
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              marginTop: -120,
              position: "relative",
              zIndex: 30,
            }}>
            <div className="mx-auto" style={{
              width: "min(95%, 1200px)",
              background: dropTarget === "hand" ? "rgba(99,179,237,0.06)" : "rgba(13,16,40,0.9)",
              border: dropTarget === "hand" ? "1px solid rgba(99,179,237,0.55)" : "1px solid rgba(99,102,241,0.18)",
              borderRadius: 14,
              boxShadow: dropTarget === "hand" ? "0 0 24px rgba(99,179,237,0.2), inset 0 1px 0 rgba(255,255,255,0.04)" : "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
              transition: "background 0.12s, border 0.12s, box-shadow 0.12s",
              overflowX: "auto",
              overflowY: "visible",
              scrollbarWidth: "none",
            }}>
              <div className="flex items-center gap-2 px-3 py-3" style={{ minWidth: "max-content" }}>
                {me.hand.length === 0 ? (
                  <div className="flex items-center justify-center w-full" style={{ minWidth: 200, minHeight: H }}>
                    <span className="text-xs text-zinc-700">Empty hand</span>
                  </div>
                ) : me.hand.map(card => {
                  const isDragging = handDrag?.card.instanceId === card.instanceId
                  return (
                    <div key={card.instanceId} className="flex-shrink-0 group/hand"
                      style={{ opacity: isDragging ? 0.2 : 1, transition: "opacity 0.15s" }}>
                      <div className="transition-all duration-150 group-hover/hand:-translate-y-2 group-hover/hand:shadow-2xl"
                        style={{ width: W, height: H, position: "relative", borderRadius: 8 }}>
                        {card.imageUri ? (
                          <img src={card.imageUri} alt={card.name} draggable={false}
                            className="shadow-lg select-none"
                            style={{ width: W, height: H, display: "block", borderRadius: 8, cursor: "grab" }}
                            onMouseDown={e => {
                              if (e.button !== 0) return
                              e.preventDefault()
                              setHandDrag({ card, x: e.clientX, y: e.clientY })
                            }}
                            onContextMenu={e => openCtx(e, card.instanceId, "hand")} />
                        ) : (
                          <div className="rounded-lg flex flex-col items-center justify-center text-center p-1 select-none"
                            style={{ width: W, height: H, background: tokenBg(card.colorIdentity), border: `1.5px solid ${tokenBd(card.colorIdentity)}`, cursor: "grab" }}
                            onMouseDown={e => {
                              if (e.button !== 0) return
                              e.preventDefault()
                              setHandDrag({ card, x: e.clientX, y: e.clientY })
                            }}
                            onContextMenu={e => openCtx(e, card.instanceId, "hand")}>
                            <span className="text-[8px] font-bold text-white/80 leading-tight">{card.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: chat ────────────────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 flex flex-col min-h-0">
          <ChatPanel messages={game.chat} onSend={text => dispatch({ type: "CHAT", text })} />
        </div>
      </div>

      {/* ── Drag ghost portal ─────────────────────────────────────────────────── */}
      {mounted && (handDrag || cmdDrag) && (() => {
        const drag = (handDrag ?? cmdDrag)!
        const card = drag.card
        return createPortal(
          <div style={{ position: "fixed", pointerEvents: "none", zIndex: 9999, left: drag.x - W / 2, top: drag.y - H / 2, width: W, height: H, opacity: 0.92, transform: "scale(1.07) rotate(-1.5deg)", filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.85))" }}>
            {card.imageUri ? (
              <img src={card.imageUri} alt={card.name} draggable={false} className="w-full h-full rounded-lg" style={{ objectFit: "cover", objectPosition: "top" }} />
            ) : (
              <div className="w-full h-full rounded-lg flex flex-col items-center justify-center text-center p-1"
                style={{ background: tokenBg(card.colorIdentity), border: `1.5px solid ${tokenBd(card.colorIdentity)}` }}>
                <span className="text-[9px] font-bold text-white/80">{card.name}</span>
              </div>
            )}
          </div>,
          document.body
        )
      })()}

      {/* ── Context menu ─────────────────────────────────────────────────────── */}
      {ctxMenu && <CardContextMenu menu={ctxMenu} myPlayer={me} onAction={dispatch} onClose={closeCtx} onZoom={setZoomed} />}

      {/* ── Zone modals ───────────────────────────────────────────────────────── */}
      {showGY && (
        <ZoneModal title="Graveyard" icon={<Flame className="w-4 h-4 text-red-400" />}
          cards={me.graveyard} emptyText="Graveyard is empty"
          onClose={() => setShowGY(false)} onAction={dispatch} />
      )}
      {showExile && (
        <ZoneModal title="Exile" icon={<Sparkles className="w-4 h-4 text-violet-400" />}
          cards={me.exile} emptyText="Nothing in exile"
          onClose={() => setShowExile(false)} onAction={dispatch} />
      )}
      {showLibrary && (
        <ZoneModal title="Library" icon={<BookOpen className="w-4 h-4 text-indigo-400" />}
          cards={me.library} emptyText="Library is empty"
          onClose={() => setShowLibrary(false)} onAction={dispatch}
          extraActions={
            <button onClick={() => dispatch({ type: "SHUFFLE" })}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.07] transition-colors">
              <Shuffle className="w-3 h-3" /> Shuffle
            </button>
          } />
      )}
      {showScry && me.library.length > 0 && (
        <ScryModal library={me.library}
          onBottom={id => dispatch({ type: "SCRY_BOTTOM", instanceId: id })}
          onKeep={() => setShowScry(false)}
          onClose={() => setShowScry(false)} />
      )}
      {showMill && (
        <MillModal libraryCount={me.libraryCount}
          onMill={n => dispatch({ type: "MILL", count: n })}
          onClose={() => setShowMill(false)} />
      )}

      {/* ── Token creator ─────────────────────────────────────────────────────── */}
      {showTokenCreator && (
        <TokenCreator
          onCreate={createToken}
          onClose={() => setShowTokenCreator(false)} />
      )}

      {/* ── Zoom ──────────────────────────────────────────────────────────────── */}
      {zoomed && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80"
          onClick={() => setZoomed(null)}>
          <img src={zoomed} alt="" className="max-h-[85vh] rounded-xl shadow-2xl" draggable={false} />
          <button onClick={() => setZoomed(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}
