"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  Copy, Check, Loader2, Users, Play, Crown, ArrowLeft,
  Send, X, Shuffle, BookOpen, Flame, Sparkles, Eye, Droplet, Swords, Skull,
} from "lucide-react"
import type { GameState, PlayerState, GameCard, GameAction, GamePhase, Zone } from "@/types/game"
import { applyAction } from "@/lib/applyGameAction"
import { scryfallImage } from "@/lib/scryfall"
import { parseCardAbilities, counterColor, counterAbbr } from "@/lib/counters"
import { useHandScroll, HandScrollButtons } from "@/components/HandScroller"
import { useHoverPreview } from "@/components/HoverPreview"
import { ConfirmDialog } from "@/components/ConfirmDialog"

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
// CSS card back — self-contained so it never 404s the way the old Scryfall image did
const CARD_BACK_BG = "radial-gradient(circle at 50% 32%, #3a3170 0%, #1c1742 48%, #0b0920 100%)"

function CardBack() {
  return (
    <div className="w-full h-full relative overflow-hidden rounded-lg" style={{ background: CARD_BACK_BG }}>
      <div className="absolute inset-[5px] rounded-md" style={{ border: "1px solid rgba(150,140,230,0.22)" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{
          width: "44%", aspectRatio: "1", transform: "rotate(45deg)", borderRadius: 4,
          background: "linear-gradient(135deg, rgba(180,160,255,0.30), rgba(90,70,180,0.10))",
          border: "1px solid rgba(180,160,255,0.4)",
          boxShadow: "0 0 14px rgba(140,110,240,0.35), inset 0 0 8px rgba(180,160,255,0.2)",
        }} />
      </div>
    </div>
  )
}

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
        <img src={scryfallImage(card.flipped && card.imageUriBack ? card.imageUriBack : card.imageUri, "large")} alt={card.name} className="w-full h-full object-cover object-top" loading="lazy" />
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
// ── OpponentBoard ─────────────────────────────────────────────────────────────
// Read-only view of one opponent, filling its column. You can't touch their life
// or counters — only see their board, life, commanders, and zone counts.
// Shared battlefield card face (image/flip/token + counter badges). The wrapper
// (sizing, drag/tap handlers) lives in each board, so the look stays identical
// on your board and on the read-only opponent boards.
function BFCardFace({ card }: { card: GameCard }) {
  const activeCounters = Object.entries(card.counters).filter(([, v]) => v > 0)
  return (
    <>
      {card.imageUri ? (
        <img src={scryfallImage(card.flipped && card.imageUriBack ? card.imageUriBack : card.imageUri, "large")} alt={card.name} draggable={false}
          className="w-full h-full rounded-lg shadow-xl select-none" style={{ objectFit: "cover", objectPosition: "top" }} />
      ) : (
        <div className="w-full h-full rounded-lg flex flex-col items-center justify-center p-2 text-center select-none"
          style={{ background: tokenBg(card.colorIdentity), border: `1.5px solid ${tokenBd(card.colorIdentity)}` }}>
          <span className="text-[10px] font-bold text-white/90 leading-snug">{card.name}</span>
          {card.typeLine && <span className="text-[8px] text-white/40 mt-0.5 leading-none">{card.typeLine.replace(/^Token\s*/i, "")}</span>}
        </div>
      )}
      {activeCounters.length > 0 && (
        <div className="absolute -top-1 -right-1 flex flex-col items-end gap-0.5 pointer-events-none" style={{ zIndex: 2 }}>
          {activeCounters.map(([name, count]) => (
            <div key={name} className="flex items-center gap-0.5 px-1 rounded-full text-[9px] font-black leading-none py-0.5"
              style={{ background: counterColor(name), color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
              <span>{name.slice(0, 3)}</span><span>×{count}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// A read-only, full-size mirror of an opponent's battlefield — same playmat,
// command zone, zone piles, and card size as your own board, positioned from the
// same normalized coordinates so you see exactly what they see.
function OpponentBoard({ player, angle, onZoom, hoverProps }: {
  player: PlayerState; angle: number; onZoom: (uri: string) => void
  hoverProps: ReturnType<typeof useHoverPreview>["hoverProps"]
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const obsRef = useRef<ResizeObserver | null>(null)
  const setNode = useCallback((node: HTMLDivElement | null) => {
    if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
    if (!node) return
    const apply = () => { const r = node.getBoundingClientRect(); setSize({ w: r.width, h: r.height }) }
    apply()
    const obs = new ResizeObserver(apply)
    obs.observe(node)
    obsRef.current = obs
  }, [])

  const seatColor = SEAT_COLORS[player.seatIndex % 4]
  const dead = player.life <= 0
  const lifeColor = player.life <= 5 ? "#ef4444" : player.life <= 10 ? "#f97316" : seatColor
  // Render the board in its natural orientation at the inner dimensions, then rotate
  // the whole thing to match where this player sits relative to me at the table
  // (across = 180°, left/right = 90°/270°). For side seats the inner box is the
  // panel with width/height swapped so the rotated board still fills the column.
  const rotated = angle === 90 || angle === 270
  const innerW = rotated ? size.h : size.w
  const innerH = rotated ? size.w : size.h

  return (
    <div ref={setNode} className="relative flex-1 min-w-0 min-h-0 overflow-hidden rounded-lg"
      style={{
        background: "#06070e",
        backgroundImage: ["radial-gradient(ellipse at 30% 40%, rgba(12,14,32,0.9) 0%, transparent 60%)", "radial-gradient(ellipse at 70% 60%, rgba(10,11,26,0.7) 0%, transparent 55%)"].join(", "),
        border: `1px solid ${seatColor}33`,
      }}>
      {size.w > 0 && (
        <div className="absolute" style={{
          left: "50%", top: "50%", width: innerW, height: innerH,
          transform: `translate(-50%, -50%) rotate(${angle}deg)`, transformOrigin: "center center",
        }}>
          {/* Playmat */}
          <div className="absolute pointer-events-none" style={{
            left: "50%", top: "50%", transform: "translate(-50%, -50%)",
            width: "min(95%, 1200px)", height: "min(90%, 680px)", borderRadius: 18,
            background: "linear-gradient(150deg, #0d1028 0%, #090b20 50%, #0b0d24 100%)",
            border: `1px solid ${seatColor}22`, zIndex: 0,
          }} />

          {/* Name / life pill — counter-rotated so it stays readable from my seat */}
          <div className="absolute left-1/2 top-1.5 z-20 flex items-center gap-2 px-2.5 py-1 rounded-full pointer-events-none"
            style={{ background: "rgba(6,7,22,0.85)", border: `1px solid ${seatColor}44`, transform: `translateX(-50%) rotate(${-angle}deg)`, transformOrigin: "center center" }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seatColor }} />
            <span className="text-xs font-bold text-zinc-200">{dead ? "💀 " : ""}{player.userName}</span>
            <span className="text-base font-black tabular-nums leading-none" style={{ color: lifeColor }}>{player.life}</span>
            <span className="text-[9px] text-zinc-500 tabular-nums">{player.libraryCount}L · {player.hand.length}H · {player.graveyard.length}GY · {player.exile.length}Ex</span>
          </div>

          {/* Command zone */}
          {player.commandZone.length > 0 && (
            <div className="absolute flex flex-col gap-1.5" style={{ top: "calc(50% - min(45%, 340px) + 14px)", left: "calc(50% - min(47.5%, 600px) + 14px)", zIndex: 10 }}>
              <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500/50 pl-0.5">Command Zone</span>
              <div className="flex gap-2">
                {player.commandZone.map(c => {
                  const castCount = player.cmdCastCount[c.name] ?? 0
                  const tax = castCount * 2
                  return (
                    <div key={c.instanceId} className="relative cursor-pointer" style={{ width: W }}
                      {...hoverProps(c.imageUri)}
                      onClick={() => { if (c.imageUri) onZoom(c.imageUri) }}>
                      {c.imageUri
                        ? <img src={scryfallImage(c.imageUri, "large")} alt={c.name} draggable={false} className="rounded-lg shadow-2xl select-none" style={{ width: W, height: H, objectFit: "cover", objectPosition: "top", border: "1.5px solid rgba(245,158,11,0.5)" }} />
                        : <div className="rounded-lg flex items-center justify-center text-[9px] text-amber-400/60 text-center p-1" style={{ width: W, height: H, background: "#1a1a2e", border: "1.5px solid rgba(245,158,11,0.5)" }}>{c.name}</div>}
                      <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between pointer-events-none" style={{ zIndex: 2 }}>
                        <span className="text-[8px] font-bold rounded px-1 py-0.5" style={{ background: "rgba(0,0,0,0.82)", color: castCount > 0 ? "#fbbf24" : "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>{castCount}×{tax > 0 ? ` +${tax}` : ""}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Zone piles */}
          <div className="absolute flex items-end gap-3" style={{ bottom: "calc(50% - min(45%, 340px) + 14px)", right: "calc(50% - min(47.5%, 600px) + 14px)", zIndex: 10 }}>
            {([["Exile", player.exile.length, "#a78bfa"], ["Graveyard", player.graveyard.length, "#f87171"]] as const).map(([label, n, col]) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div className="rounded-lg flex flex-col items-center justify-center gap-1" style={{ width: ZW, height: ZH, background: "rgba(0,0,0,0.4)", border: `1.5px solid ${col}55` }}>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: col }}>{label.slice(0, 5)}</span>
                  <span className="text-2xl font-black text-white tabular-nums leading-none">{n}</span>
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">{label}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative rounded-lg overflow-hidden" style={{ width: ZW, height: ZH, boxShadow: "0 4px 20px rgba(0,0,0,0.7)" }}>
                <CardBack />
                <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                  <span className="text-xs font-black text-white tabular-nums px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.75)" }}>{player.libraryCount}</span>
                </div>
              </div>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Library</span>
            </div>
          </div>

          {/* Battlefield permanents — full size, click to zoom */}
          {player.battlefield.map(card => {
            const left = (card.x ?? 0.5) * innerW - W / 2
            const top = (card.y ?? 0.5) * innerH - H / 2
            const face = card.flipped && card.imageUriBack ? card.imageUriBack : card.imageUri
            return (
              <div key={card.instanceId} className="absolute select-none cursor-pointer"
                {...hoverProps(face)}
                style={{ left, top, width: W, height: H, transform: card.tapped ? "rotate(90deg)" : "none", transformOrigin: "center center", filter: card.tapped ? "brightness(0.8) saturate(0.8)" : "none", zIndex: 50 + (card.z ?? 0) }}
                onClick={() => { if (face) onZoom(face) }}>
                <BFCardFace card={card} />
                {card.tapped && <div className="absolute inset-0 rounded-lg ring-1 ring-amber-500/20 pointer-events-none" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── CmdDamageTracker ──────────────────────────────────────────────────────────
// Defender-centric: you log commander damage YOU'VE taken from each opponent's
// commander. Each +/- lowers your own life. Lethal at 21 from one commander.
function CmdDamageTracker({ me, opponents, onRecord }: {
  me: PlayerState; opponents: PlayerState[]
  onRecord: (fromSeat: number, amount: number) => void
}) {
  const [open, setOpen] = useState(false)
  const dmgFrom = (seat: number) => me.commanderDamage?.[String(seat)] ?? 0
  const active = opponents.filter(o => dmgFrom(o.seatIndex) > 0)
  return (
    <div className="relative flex items-center gap-1">
      {active.map(o => {
        const d = dmgFrom(o.seatIndex)
        return (
          <span key={o.userId} className="flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold tabular-nums"
            style={{ background: d >= 21 ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.3)", border: `1px solid ${SEAT_COLORS[o.seatIndex % 4]}55`, color: d >= 21 ? "#ef4444" : "#fbbf24" }}>
            <Skull className="w-2.5 h-2.5" />{d}
          </span>
        )
      })}
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }} title="Commander damage taken"
        className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors">
        <Skull className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[290]" onClick={e => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute right-0 top-8 z-[300] py-1.5 rounded-xl shadow-2xl"
            style={{ background: "rgba(10,10,24,0.98)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(20px)", minWidth: 200 }}
            onClick={e => e.stopPropagation()}>
            <p className="px-3 pb-1 text-[9px] text-zinc-600 font-semibold uppercase tracking-wider">Commander damage taken</p>
            {opponents.length === 0 && <p className="px-3 py-1 text-[10px] text-zinc-600">No opponents</p>}
            {opponents.map(o => {
              const d = dmgFrom(o.seatIndex)
              const lethal = d >= 21
              return (
                <div key={o.userId} className="flex items-center justify-between gap-2 px-3 py-0.5">
                  <span className="flex items-center gap-1.5 text-xs text-zinc-300 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEAT_COLORS[o.seatIndex % 4] }} />
                    <span className="truncate">{o.userName}</span>
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onRecord(o.seatIndex, -1)} disabled={d === 0} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] disabled:opacity-20 text-sm font-bold flex items-center justify-center">−</button>
                    <span className="text-[10px] tabular-nums w-5 text-center font-bold" style={{ color: lethal ? "#ef4444" : d > 0 ? "#fbbf24" : "#71717a" }}>{d}</span>
                    <button onClick={() => onRecord(o.seatIndex, 1)} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] text-sm font-bold flex items-center justify-center">+</button>
                  </span>
                </div>
              )
            })}
          </div>
        </>
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
function ZoneModal({ title, icon, cards, emptyText, onClose, onAction, onZoom, extraActions }: {
  title: string; icon: React.ReactNode; cards: GameCard[]; emptyText: string
  onClose: () => void; onAction: (a: GameAction) => void; onZoom: (uri: string) => void; extraActions?: React.ReactNode
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
          {ctx.card.imageUri && <ZoneMenuItem label="Zoom" onClick={() => { onZoom(ctx.card.imageUri); setCtx(null) }} />}
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
function ScryModal({ library, onResolve, onClose }: {
  library: GameCard[]
  onResolve: (top: string[], bottom: string[], graveyard: string[]) => void
  onClose: () => void
}) {
  // Freeze the library at open so 2s polls can't reset the player's choices mid-scry.
  const [snapshot] = useState(() => library)
  const [n, setN] = useState(1)
  const [items, setItems] = useState<{ id: string; where: "top" | "bottom" | "gy" }[]>(
    () => snapshot.slice(0, 1).map(c => ({ id: c.instanceId, where: "top" as const })))
  useEffect(() => {
    setItems(snapshot.slice(0, n).map(c => ({ id: c.instanceId, where: "top" as const })))
  }, [n, snapshot])

  const cardById = new Map(snapshot.map(c => [c.instanceId, c]))
  const maxN = snapshot.length
  const WHERE_LABEL = { top: "Top", bottom: "Bottom", gy: "Grave" } as const
  const WHERE_COLOR = { top: "#4ade80", bottom: "#818cf8", gy: "#f87171" } as const

  const setWhere = (id: string, where: "top" | "bottom" | "gy") =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, where } : it))
  const reorder = (idx: number, dir: -1 | 1) =>
    setItems(prev => {
      const j = idx + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  const confirm = () => {
    onResolve(
      items.filter(i => i.where === "top").map(i => i.id),
      items.filter(i => i.where === "bottom").map(i => i.id),
      items.filter(i => i.where === "gy").map(i => i.id),
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.80)" }} onClick={onClose}>
      <div className="rounded-2xl p-5 shadow-2xl w-full max-w-md" style={{ background: "#0d0e20", border: "1px solid rgba(255,255,255,0.09)", maxHeight: "82vh" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-zinc-200">Scry / Surveil</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setN(v => Math.max(1, v - 1))} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] font-bold text-xs flex items-center justify-center">−</button>
              <span className="text-xs text-zinc-300 w-4 text-center">{n}</span>
              <button onClick={() => setN(v => Math.min(maxN, v + 1))} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] font-bold text-xs flex items-center justify-center">+</button>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[10px] text-zinc-600 mb-3">Reorder the top, or send cards to the bottom / graveyard. Top cards return in the order shown.</p>
        <div className="space-y-1.5 overflow-y-auto mb-4" style={{ maxHeight: "52vh", scrollbarWidth: "thin" }}>
          {items.map((it, idx) => {
            const card = cardById.get(it.id)
            if (!card) return null
            return (
              <div key={it.id} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                {card.imageUri
                  ? <img src={card.imageUri} alt={card.name} className="rounded object-cover object-top flex-shrink-0" style={{ width: 30, height: 42 }} />
                  : <div className="rounded flex-shrink-0" style={{ width: 30, height: 42, background: tokenBg(card.colorIdentity) }} />}
                <span className="text-xs text-zinc-200 flex-1 min-w-0 truncate">{card.name}</span>
                <div className="flex flex-col flex-shrink-0">
                  <button onClick={() => reorder(idx, -1)} disabled={idx === 0} className="text-zinc-600 hover:text-white disabled:opacity-20 text-[10px] leading-none h-3">▲</button>
                  <button onClick={() => reorder(idx, 1)} disabled={idx === items.length - 1} className="text-zinc-600 hover:text-white disabled:opacity-20 text-[10px] leading-none h-3">▼</button>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {(["top", "bottom", "gy"] as const).map(w => (
                    <button key={w} onClick={() => setWhere(it.id, w)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors"
                      style={{ background: it.where === w ? `${WHERE_COLOR[w]}22` : "transparent", color: it.where === w ? WHERE_COLOR[w] : "rgba(255,255,255,0.3)", border: `1px solid ${it.where === w ? WHERE_COLOR[w] : "transparent"}` }}>
                      {WHERE_LABEL[w]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {items.length === 0 && <p className="text-xs text-zinc-700 py-8 text-center">Library is empty</p>}
        </div>
        <button onClick={confirm} className="w-full py-2 rounded-lg text-sm font-bold text-zinc-950 bg-amber-500 hover:bg-amber-400 transition-colors">Done</button>
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
  // Counter +/- shouldn't close the menu, so you can adjust repeatedly
  const bump = (name: string, delta: number) => onAction({ type: "ADD_COUNTER", instanceId: menu.instanceId, counterName: name, delta })
  const isCommander = /legendary.*creature|planeswalker/i.test(card.typeLine)
  // Counter types detected from oracle text (+ basics + loyalty/lore for PW/saga)
  const parsed = parseCardAbilities(card.oracleText ?? "", card.typeLine)
  const counterNames = Array.from(new Set([...parsed.counterNames, "+1/+1", "-1/-1"]))

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
        {card.imageUriBack && <ZoneMenuItem label={card.flipped ? "Flip to Front" : "Flip / Transform"} onClick={() => { onAction({ type: "FLIP", instanceId: menu.instanceId }); onClose() }} />}
        <ZoneMenuItem label="Copy" onClick={() => { onAction({ type: "COPY", instanceId: menu.instanceId, newInstanceId: `copy-${Date.now()}-${Math.random().toString(36).slice(2)}` }); onClose() }} />
        <div className="h-px mx-3 my-1 bg-white/[0.06]" />
        <ZoneMenuItem label="Return to Hand"        onClick={() => move("hand")} />
        <ZoneMenuItem label="Send to Graveyard"     onClick={() => move("graveyard")} />
        <ZoneMenuItem label="Exile"                 onClick={() => move("exile")} />
        <ZoneMenuItem label="Put on Top of Library" onClick={toTop} />
        {isCommander && <ZoneMenuItem label="Return to Command Zone" onClick={() => move("commandZone")} />}
        <div className="h-px mx-3 my-1 bg-white/[0.06]" />
        <p className="px-4 pt-0.5 pb-1 text-[9px] text-zinc-600 font-semibold uppercase tracking-wider">Counters</p>
        <div className="px-3 pb-1 max-h-44 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {counterNames.map(name => (
            <div key={name} className="flex items-center justify-between gap-2 py-0.5">
              <span className="flex items-center gap-1.5 text-xs text-zinc-300 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: counterColor(name) }} />
                <span className="truncate">{name}</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => bump(name, -1)} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] text-sm font-bold flex items-center justify-center">−</button>
                <span className="text-[10px] tabular-nums text-zinc-500 w-4 text-center">{card.counters[name] ?? 0}</span>
                <button onClick={() => bump(name, 1)} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] text-sm font-bold flex items-center justify-center">+</button>
              </span>
            </div>
          ))}
        </div>
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

// ── StatusToggle ──────────────────────────────────────────────────────────────
// Monarch / initiative claim button. Click to claim for yourself; click again
// (while you hold it) to clear. Trust model: anyone can claim.
function StatusToggle({ icon, label, holderSeat, holderName, mySeat, onClaim, onClear }: {
  icon: React.ReactNode; label: string; holderSeat: number | null; holderName: string
  mySeat: number; onClaim: () => void; onClear: () => void
}) {
  const held = holderSeat != null
  const mine = holderSeat === mySeat
  const color = held ? SEAT_COLORS[holderSeat % 4] : "rgba(255,255,255,0.35)"
  return (
    <button onClick={e => { e.stopPropagation(); mine ? onClear() : onClaim() }}
      title={held ? `${label}: ${holderName}${mine ? " (click to clear)" : ""}` : `Claim ${label}`}
      className="flex items-center gap-1 px-1.5 h-6 rounded transition-colors flex-shrink-0"
      style={{ background: held ? `${color}22` : "transparent", border: `1px solid ${held ? color : "rgba(255,255,255,0.08)"}`, color }}>
      {icon}
      {held && <span className="text-[9px] font-bold max-w-[56px] truncate">{holderName}</span>}
    </button>
  )
}

// ── PlayerCounters ────────────────────────────────────────────────────────────
// Your own player-level counters (poison, energy, …). Active ones show as chips;
// the droplet button opens a small editor for all common types.
const PLAYER_COUNTER_TYPES = ["poison", "energy", "experience", "rad"] as const

function PlayerCounters({ counters, onAdjust }: {
  counters: Record<string, number>
  onAdjust: (name: string, delta: number) => void
}) {
  const [open, setOpen] = useState(false)
  const active = Object.entries(counters).filter(([, v]) => v > 0)
  return (
    <div className="relative flex items-center gap-1">
      {active.map(([name, v]) => (
        <span key={name} className="flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold tabular-nums"
          style={{ background: `${counterColor(name)}22`, border: `1px solid ${counterColor(name)}55`, color: counterColor(name) }}>
          <span>{counterAbbr(name)}</span><span>{v}</span>
        </span>
      ))}
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }} title="Player counters"
        className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors">
        <Droplet className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[290]" onClick={e => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute right-0 top-8 z-[300] py-1.5 rounded-xl shadow-2xl"
            style={{ background: "rgba(10,10,24,0.98)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(20px)", minWidth: 180 }}
            onClick={e => e.stopPropagation()}>
            <p className="px-3 pb-1 text-[9px] text-zinc-600 font-semibold uppercase tracking-wider">Your Counters</p>
            {PLAYER_COUNTER_TYPES.map(name => (
              <div key={name} className="flex items-center justify-between gap-2 px-3 py-0.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-300 capitalize">
                  <span className="w-2 h-2 rounded-full" style={{ background: counterColor(name) }} />
                  {name}
                </span>
                <span className="flex items-center gap-1">
                  <button onClick={() => onAdjust(name, -1)} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] text-sm font-bold flex items-center justify-center">−</button>
                  <span className="text-[10px] tabular-nums text-zinc-400 w-4 text-center">{counters[name] ?? 0}</span>
                  <button onClick={() => onAdjust(name, 1)} className="w-5 h-5 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] text-sm font-bold flex items-center justify-center">+</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
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
  const [libCtx, setLibCtx] = useState<{ x: number; y: number } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const [showGY, setShowGY] = useState(false)
  const [showExile, setShowExile] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showScry, setShowScry] = useState(false)
  const [showMill, setShowMill] = useState(false)
  const [showTokenCreator, setShowTokenCreator] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Mulligan: instanceIds selected to bottom on keep (local until KEEP_HAND)
  const [bottomSel, setBottomSel] = useState<Set<string>>(new Set())

  // My board's pixel size, for converting normalized positions ↔ pixels on render.
  const [bfSize, setBfSize] = useState({ w: 0, h: 0 })
  const { hoverProps, preview: hoverPreview } = useHoverPreview()
  // Transient normalized position of the card I'm currently dragging (committed on drop).
  const [dragNorm, setDragNorm] = useState<{ id: string; x: number; y: number } | null>(null)

  // Drag
  const [handDrag, setHandDrag] = useState<{ card: GameCard; x: number; y: number } | null>(null)
  const [cmdDrag, setCmdDrag] = useState<{ card: GameCard; x: number; y: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<"graveyard" | "exile" | "hand" | "commandZone" | "battlefield" | null>(null)

  // Refs
  const bfRef      = useRef<HTMLDivElement | null>(null)
  const bfSizeRef  = useRef({ w: 0, h: 0 })
  const bfObsRef   = useRef<ResizeObserver | null>(null)
  // bfDrag.ox/oy hold the card's normalized center at drag start.
  const bfDrag     = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const dragNormRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const bfClickBlocked = useRef(false)
  const gyRef      = useRef<HTMLButtonElement>(null)
  const exileRef   = useRef<HTMLButtonElement>(null)
  const handZoneRef = useRef<HTMLDivElement>(null)
  const cmdZoneRef = useRef<HTMLDivElement>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const meRef      = useRef<PlayerState | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Callback ref: attach the size observer when the board node actually mounts
  // (it isn't in the DOM during the loading/lobby/mulligan screens). Positions are
  // normalized, so a resize needs no rescaling — render just multiplies by the size.
  const setBfNode = useCallback((node: HTMLDivElement | null) => {
    bfRef.current = node
    if (bfObsRef.current) { bfObsRef.current.disconnect(); bfObsRef.current = null }
    if (!node) return
    const apply = () => {
      const r = node.getBoundingClientRect()
      bfSizeRef.current = { w: r.width, h: r.height }
      setBfSize({ w: r.width, h: r.height })
    }
    apply()
    const obs = new ResizeObserver(apply)
    obs.observe(node)
    bfObsRef.current = obs
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
  const handScroll = useHandScroll(me?.hand.length ?? 0)

  const dispatch = useCallback(async (action: GameAction) => {
    // Optimistic update through the exact same reducer the server runs, so the
    // local guess can't diverge from authoritative state.
    setGame(prev => (prev ? applyAction(prev, userId, action) : prev))
    // Persist, then trust the server's returned state over our optimistic guess
    // (a stale 2s poll can't revert an action we just took).
    try {
      const res = await fetch(`/api/game/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.game) setGame(data.game)
      }
    } catch {
      // Network error — the next poll reconciles.
    }
  }, [code, userId])

  const closeCtx = useCallback(() => { setCtxMenu(null); setLibCtx(null) }, [])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Escape") {
        setCtxMenu(null); setZoomed(null)
        setShowGY(false); setShowExile(false); setShowLibrary(false)
        setShowScry(false); setShowMill(false); setShowTokenCreator(false)
        return
      }
      if (game?.status !== "active") return
      const k = e.key.toLowerCase()
      if (k === "d") dispatch({ type: "DRAW" })
      else if (k === "u") dispatch({ type: "UNTAP_ALL" })
      else if (k === "n") dispatch({ type: "NEXT_PHASE" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dispatch, game?.status])

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
        const bw = bfSizeRef.current.w || 1, bh = bfSizeRef.current.h || 1
        const nx = Math.max(0, Math.min(1, bfDrag.current.ox + dx / bw))
        const ny = Math.max(0, Math.min(1, bfDrag.current.oy + dy / bh))
        dragNormRef.current = { id, x: nx, y: ny }
        setDragNorm({ id, x: nx, y: ny })
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
      else if (dragNormRef.current?.id === id) {
        // Stayed on the battlefield — commit the new normalized position for everyone.
        dispatch({ type: "SET_POSITION", instanceId: id, x: dragNormRef.current.x, y: dragNormRef.current.y })
      }
    }
    bfDrag.current = null
    dragNormRef.current = null
    setDragNorm(null)
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
        const x = Math.max(0, Math.min(1, (cx - bf.left) / bf.width))
        const y = Math.max(0, Math.min(1, (cy - bf.top) / bf.height))
        dispatch({ type: "MOVE", instanceId: handDrag.card.instanceId, fromZone: "hand", toZone: "battlefield", x, y })
      }
      setHandDrag(null)
    }

    if (cmdDrag) {
      const bf = bfRef.current?.getBoundingClientRect()
      if (bf && over(bf, cx, cy)) {
        const x = Math.max(0, Math.min(1, (cx - bf.left) / bf.width))
        const y = Math.max(0, Math.min(1, (cy - bf.top) / bf.height))
        dispatch({ type: "CAST_COMMANDER", instanceId: cmdDrag.card.instanceId, x, y })
      }
      setCmdDrag(null)
      setDropTarget(null)
    }
  }, [handDrag, cmdDrag, dispatch])

  const createToken = useCallback((name: string, colors: string[], typeLine: string) => {
    const instanceId = `token-${Date.now()}-${Math.random().toString(36).slice(2)}`
    dispatch({ type: "CREATE_TOKEN", instanceId, name, typeLine, colorIdentity: colors })
  }, [dispatch])

  const copyCode = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const opponents = game?.players.filter(p => p.userId !== userId) ?? []
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
          <button onClick={() => setConfirmLeave(true)} className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Leave game</button>
        </div>
        <ConfirmDialog
          open={confirmLeave}
          title="Leave the game?"
          message="You'll return to the games list and have to rejoin with the code."
          confirmLabel="Leave"
          danger
          onConfirm={() => router.push("/game")}
          onCancel={() => setConfirmLeave(false)}
        />
      </div>
    )
  }

  if (!me) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#06071c" }}>
      <p className="text-zinc-400">You are not in this game.</p>
    </div>
  )

  // ── Mulligan phase ───────────────────────────────────────────────────────────
  if (game.status === "mulligan") {
    const joined = game.players.filter(p => p.joined)
    const toBottom = Math.max(0, (me.mulligans ?? 0) - (game.freeMulligan ? 1 : 0))
    const needsBottom = toBottom > 0
    const remaining = toBottom - bottomSel.size
    const canKeep = !me.kept && bottomSel.size === toBottom
    const MW = 100, MH = Math.round(MW * 88 / 63)

    const toggleSel = (id: string) => {
      if (me.kept || !needsBottom) return
      setBottomSel(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else if (next.size < toBottom) next.add(id)
        return next
      })
    }
    const keep = () => { if (canKeep) dispatch({ type: "KEEP_HAND", bottom: [...bottomSel] }) }
    const mull = () => { setBottomSel(new Set()); dispatch({ type: "MULLIGAN" }) }

    return (
      <div className="fixed inset-0 flex flex-col items-center overflow-y-auto px-4 py-8" style={{ background: "#06071c" }}>
        <div className="w-full max-w-5xl flex flex-col items-center gap-6">

          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Mulligan</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {me.kept
                ? "You've kept. Waiting for the other players…"
                : needsBottom
                  ? `Choose ${remaining} more card${remaining !== 1 ? "s" : ""} to put on the bottom of your library`
                  : "Keep this hand, or mulligan for a new one"}
            </p>
          </div>

          {/* Free-mulligan house rule */}
          {isHost ? (
            <button onClick={() => dispatch({ type: "SET_FREE_MULLIGAN", value: !game.freeMulligan })}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors"
              style={{ background: game.freeMulligan ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${game.freeMulligan ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.1)"}`, color: game.freeMulligan ? "#4ade80" : "#a1a1aa" }}>
              First mulligan free: {game.freeMulligan ? "On" : "Off"}
            </button>
          ) : game.freeMulligan ? (
            <span className="text-[11px] font-semibold text-green-400/80">First mulligan free</span>
          ) : null}

          {/* Readiness row */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {joined.map(p => (
              <div key={p.userId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${p.kept ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)"}` }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEAT_COLORS[p.seatIndex % 4] }} />
                <span className="text-xs text-zinc-300">{p.userName}{p.userId === userId ? " (you)" : ""}</span>
                {p.kept
                  ? <Check className="w-3.5 h-3.5 text-green-400" />
                  : <span className="text-[10px] text-zinc-600">deciding…</span>}
                {p.mulligans > 0 && <span className="text-[9px] text-amber-500/70 font-bold">−{p.mulligans}</span>}
              </div>
            ))}
          </div>

          {/* Hand */}
          <div className="flex flex-wrap justify-center gap-3" style={{ opacity: me.kept ? 0.5 : 1 }}>
            {me.hand.map(card => {
              const sel = bottomSel.has(card.instanceId)
              return (
                <div key={card.instanceId} onClick={() => toggleSel(card.instanceId)}
                  className="relative rounded-lg overflow-hidden transition-all"
                  style={{
                    width: MW, height: MH,
                    cursor: needsBottom && !me.kept ? "pointer" : "default",
                    outline: sel ? "3px solid #f59e0b" : "1px solid rgba(255,255,255,0.08)",
                    outlineOffset: -1,
                    transform: sel ? "translateY(8px)" : "none",
                    boxShadow: sel ? "0 10px 30px rgba(245,158,11,0.25)" : "0 4px 16px rgba(0,0,0,0.5)",
                  }}>
                  {card.imageUri
                    ? <img src={scryfallImage(card.imageUri, "large")} alt={card.name} className="w-full h-full object-cover object-top" draggable={false} />
                    : <div className="w-full h-full flex items-center justify-center text-center p-1 text-[9px] text-white/80"
                        style={{ background: tokenBg(card.colorIdentity), border: `1.5px solid ${tokenBd(card.colorIdentity)}` }}>{card.name}</div>}
                  {sel && (
                    <div className="absolute bottom-0 inset-x-0 bg-amber-500 text-center py-0.5">
                      <span className="text-[9px] font-black text-zinc-950 uppercase tracking-wider">Bottom</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions */}
          {!me.kept ? (
            <div className="flex items-center gap-3">
              <button onClick={mull}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Shuffle className="w-4 h-4" /> Mulligan{me.mulligans > 0 ? ` (${me.mulligans})` : ""}
              </button>
              <button onClick={keep} disabled={!canKeep}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-zinc-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-amber-500/25">
                <Check className="w-4 h-4" /> Keep Hand
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Waiting for other players…
            </div>
          )}

          {/* Host override */}
          {isHost && (
            <button onClick={() => dispatch({ type: "FORCE_START" })}
              className="text-xs text-zinc-600 hover:text-amber-400 transition-colors mt-1">
              Start anyway · lock in everyone&apos;s current hand
            </button>
          )}
        </div>
      </div>
    )
  }

  const openCtx = (e: React.MouseEvent, instanceId: string, zone: Zone) => {
    e.preventDefault(); e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, instanceId, zone })
  }

  // Split-screen seating, driven by turn order. My board is bottom-left; opponents
  // fill the other quadrants. The top row sits "across the table" (rotated 180°), a
  // 4th player sits bottom-right upright. 2 players = stacked (opponent on top).
  const seatOrder = game.players.filter(p => p.joined).map(p => p.seatIndex).sort((a, b) => a - b)
  const myPos = seatOrder.indexOf(me.seatIndex)
  const kOf = (seat: number) => {
    const pos = seatOrder.indexOf(seat)
    return pos < 0 || myPos < 0 ? 0 : ((pos - myPos) % seatOrder.length + seatOrder.length) % seatOrder.length
  }
  const orderedOpps = [...opponents].sort((a, b) => kOf(a.seatIndex) - kOf(b.seatIndex))
  const quad = opponents.length >= 2
  const gridCols = quad ? "1fr 1fr" : "1fr"
  const topCellOpps = quad ? orderedOpps.slice(0, 2) : orderedOpps  // top row, rotated 180°
  const brOpp = quad ? orderedOpps[2] : undefined                   // bottom-right, upright

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

        <button onClick={() => setConfirmLeave(true)} className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0" aria-label="Leave game">
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

        <div className="w-px h-5 bg-white/[0.07]" />
        <StatusToggle icon={<Crown className="w-3 h-3" />} label="Monarch"
          holderSeat={game.monarch ?? null} mySeat={me.seatIndex}
          holderName={game.players.find(p => p.seatIndex === game.monarch)?.userName ?? "?"}
          onClaim={() => dispatch({ type: "SET_MONARCH", seat: me.seatIndex })}
          onClear={() => dispatch({ type: "SET_MONARCH", seat: null })} />
        <StatusToggle icon={<Swords className="w-3 h-3" />} label="Initiative"
          holderSeat={game.initiative ?? null} mySeat={me.seatIndex}
          holderName={game.players.find(p => p.seatIndex === game.initiative)?.userName ?? "?"}
          onClaim={() => dispatch({ type: "SET_INITIATIVE", seat: me.seatIndex })}
          onClear={() => dispatch({ type: "SET_INITIATIVE", seat: null })} />

        <div className="flex-1" />

        <LifeCounter life={me.life} seat={me.seatIndex} onAdjust={d => dispatch({ type: "ADJUST_LIFE", delta: d })} />
        <PlayerCounters counters={me.playerCounters} onAdjust={(name, delta) => dispatch({ type: "ADJUST_PLAYER_COUNTER", counterName: name, delta })} />
        <CmdDamageTracker me={me} opponents={opponents} onRecord={(fromSeat, amount) => dispatch({ type: "RECORD_CMD_DAMAGE", fromSeat, amount })} />
        <div className="w-px h-5 bg-white/[0.07]" />

        <button onClick={e => { e.stopPropagation(); dispatch({ type: "DRAW" }) }}         className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Draw</button>
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "UNTAP_ALL" }) }}     className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Untap All</button>
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "SHUFFLE" }) }}       className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors flex items-center gap-1"><Shuffle className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); setShowScry(true) }}                   className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Scry</button>
        <button onClick={e => { e.stopPropagation(); setShowMill(true) }}                   className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Mill</button>
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "PROLIFERATE" }) }}    className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">Proliferate</button>
        <button onClick={e => { e.stopPropagation(); setShowTokenCreator(true) }}           className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">+ Token</button>
        <div className="w-px h-5 bg-white/[0.07]" />
        <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0">{code}</span>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0" style={{ paddingBottom: 18 }}>

        {/* ── Left: game area ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* ── Split-screen table: quadrant grid (my board bottom-left) ────── */}
          <div className="grid gap-2 p-2 flex-1 min-h-0"
            style={{ gridTemplateColumns: gridCols, gridTemplateRows: "1fr 1fr" }}>

            {/* Top row — opponents across the table (rotated 180°) */}
            {topCellOpps.map(opp => (
              <OpponentBoard key={opp.userId} player={opp} angle={180} onZoom={setZoomed} hoverProps={hoverProps} />
            ))}

            {/* ── My battlefield (bottom-left quadrant) ─────────────────────── */}
            <div ref={setBfNode} className="relative overflow-hidden rounded-lg min-w-0 min-h-0"
              style={{
                background: "#06070e",
                backgroundImage: [
                  "radial-gradient(ellipse at 30% 40%, rgba(12,14,32,0.9) 0%, transparent 60%)",
                  "radial-gradient(ellipse at 70% 60%, rgba(10,11,26,0.7) 0%, transparent 55%)",
                ].join(", "),
                border: `1px solid ${SEAT_COLORS[me.seatIndex % 4]}66`,
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

            {/* Command zone — permanent: always rendered so it stays a drop target
                for returning the commander, even when it's out on the battlefield. */}
            {(
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
                          <img src={scryfallImage(c.imageUri, "large")} alt={c.name} draggable={false}
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
                        {/* Commander tax — manual −/+ (no longer auto-incremented on cast) */}
                        <div className="absolute bottom-1.5 inset-x-1 flex items-center justify-center gap-1" style={{ zIndex: 3 }} title="Commander tax">
                          <button onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); dispatch({ type: "ADJUST_CMD_TAX", name: c.name, delta: -1 }) }}
                            disabled={castCount === 0}
                            className="w-4 h-4 rounded bg-black/80 border border-white/10 text-zinc-300 hover:text-white disabled:opacity-30 text-[11px] font-bold leading-none flex items-center justify-center">−</button>
                          <span className="text-[8px] font-bold rounded px-1 py-0.5"
                            style={{ background: "rgba(0,0,0,0.82)", color: castCount > 0 ? "#fbbf24" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            {castCount}×{tax > 0 ? ` +${tax}` : ""}
                          </span>
                          <button onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); dispatch({ type: "ADJUST_CMD_TAX", name: c.name, delta: 1 }) }}
                            className="w-4 h-4 rounded bg-black/80 border border-white/10 text-zinc-300 hover:text-white text-[11px] font-bold leading-none flex items-center justify-center">+</button>
                        </div>
                        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 flex items-end justify-center pb-10 transition-opacity pointer-events-none"
                          style={{ background: "rgba(0,0,0,0.45)" }}>
                          <span className="text-[8px] font-semibold text-zinc-300">Drag to battlefield</span>
                        </div>
                      </div>
                    )
                  })}
                  {me.commandZone.length === 0 && (
                    <div className="rounded-lg flex items-center justify-center text-center"
                      style={{ width: W, height: H, border: "1.5px dashed rgba(245,158,11,0.4)", background: dropTarget === "commandZone" ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.03)" }}>
                      <span className="text-[8px] text-amber-500/50 px-1.5 leading-tight">drag commander here</span>
                    </div>
                  )}
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
                    <div className="relative group/lib" style={{ width: ZW, height: ZH }}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setLibCtx({ x: e.clientX, y: e.clientY }) }}>
                      {count > 4 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-6px,-6px)", background: CARD_BACK_BG, border: "1px solid rgba(44,82,152,0.35)", zIndex: 1, opacity: 0.6 }} />}
                      {count > 2 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-4px,-4px)", background: CARD_BACK_BG, border: "1px solid rgba(44,82,152,0.45)", zIndex: 2, opacity: 0.75 }} />}
                      {count > 1 && <div className="absolute rounded-lg" style={{ inset: 0, transform: "translate(-2px,-2px)", background: CARD_BACK_BG, border: "1px solid rgba(44,82,152,0.55)", zIndex: 3, opacity: 0.88 }} />}
                      <button onClick={e => { e.stopPropagation(); dispatch({ type: "DRAW" }) }} disabled={empty}
                        className="absolute inset-0 rounded-lg overflow-hidden transition-transform hover:-translate-y-1 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ zIndex: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.7)" }}>
                        <CardBack />
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
            {bfSize.w > 0 && me.battlefield.map(card => {
              const norm = dragNorm?.id === card.instanceId ? dragNorm : { x: card.x ?? 0.5, y: card.y ?? 0.5 }
              const left = norm.x * bfSize.w - W / 2
              const top = norm.y * bfSize.h - H / 2
              const isDragging = bfDrag.current?.id === card.instanceId
              return (
                <div key={card.instanceId}
                  className="absolute select-none group/bfc"
                  {...hoverProps(card.flipped && card.imageUriBack ? card.imageUriBack : card.imageUri)}
                  style={{
                    left, top, width: W, height: H,
                    transform: card.tapped ? "rotate(90deg)" : "none",
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.18s ease",
                    cursor: isDragging ? "grabbing" : "grab",
                    zIndex: isDragging ? 9999 : 50 + (card.z ?? 0),
                    filter: card.tapped ? "brightness(0.8) saturate(0.8)" : "none",
                  }}
                  onMouseDown={e => {
                    if (e.button !== 0) return
                    e.stopPropagation()
                    bfDrag.current = { id: card.instanceId, sx: e.clientX, sy: e.clientY, ox: card.x ?? 0.5, oy: card.y ?? 0.5, moved: false }
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (bfClickBlocked.current) { bfClickBlocked.current = false; return }
                    dispatch({ type: "TAP", instanceId: card.instanceId })
                  }}
                  onContextMenu={e => openCtx(e, card.instanceId, "battlefield")}>

                  <BFCardFace card={card} />

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

            {/* Bottom-right quadrant — 4th player, upright */}
            {brOpp && <OpponentBoard key={brOpp.userId} player={brOpp} angle={0} onZoom={setZoomed} hoverProps={hoverProps} />}
          </div>

          {/* ── Hand zone ─────────────────────────────────────────────────── */}
          <div ref={handZoneRef} className="flex-shrink-0 select-none"
            style={{
              background: "#06070e",
              paddingTop: 8,
              paddingBottom: "max(8px, env(safe-area-inset-bottom))",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              position: "relative",
              zIndex: 30,
            }}>
            <div className="mx-auto relative" style={{
              width: "min(95%, 1200px)",
              background: dropTarget === "hand" ? "rgba(99,179,237,0.06)" : "rgba(13,16,40,0.9)",
              border: dropTarget === "hand" ? "1px solid rgba(99,179,237,0.55)" : "1px solid rgba(99,102,241,0.18)",
              borderRadius: 14,
              boxShadow: dropTarget === "hand" ? "0 0 24px rgba(99,179,237,0.2), inset 0 1px 0 rgba(255,255,255,0.04)" : "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
              transition: "background 0.12s, border 0.12s, box-shadow 0.12s",
            }}>
              <HandScrollButtons overflow={handScroll.overflow} start={handScroll.start} stop={handScroll.stop} />
              <div ref={handScroll.ref} style={{ overflowX: "auto", overflowY: "visible", scrollbarWidth: "none", borderRadius: 14 }}>
              <div className="flex items-center gap-2 px-3 py-3" style={{ minWidth: "max-content" }}>
                {me.hand.length === 0 ? (
                  <div className="flex items-center justify-center w-full" style={{ minWidth: 200, minHeight: H }}>
                    <span className="text-xs text-zinc-700">Empty hand</span>
                  </div>
                ) : me.hand.map(card => {
                  const isDragging = handDrag?.card.instanceId === card.instanceId
                  return (
                    <div key={card.instanceId} className="flex-shrink-0 group/hand"
                      {...hoverProps(card.imageUri)}
                      style={{ opacity: isDragging ? 0.2 : 1, transition: "opacity 0.15s" }}>
                      <div className="transition-all duration-150 group-hover/hand:-translate-y-2 group-hover/hand:shadow-2xl"
                        style={{ width: W, height: H, position: "relative", borderRadius: 8 }}>
                        {card.imageUri ? (
                          <img src={scryfallImage(card.imageUri, "large")} alt={card.name} draggable={false}
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
              <img src={scryfallImage(card.imageUri, "large")} alt={card.name} draggable={false} className="w-full h-full rounded-lg" style={{ objectFit: "cover", objectPosition: "top" }} />
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

      <ConfirmDialog
        open={confirmLeave}
        title="Leave the game?"
        message="You'll return to the games list. The game keeps running for the other players — rejoin with the code to come back."
        confirmLabel="Leave"
        danger
        onConfirm={() => router.push("/game")}
        onCancel={() => setConfirmLeave(false)}
      />

      {/* Library quick-actions menu (right-click the library pile) */}
      {libCtx && (() => {
        const top = me.library[0]
        const close = () => setLibCtx(null)
        const moveTop = (toZone: Zone) => { if (top) dispatch({ type: "MOVE", instanceId: top.instanceId, fromZone: "library", toZone }); close() }
        return (
          <div className="fixed z-[300] py-1 rounded-xl shadow-2xl"
            style={{
              left: clamp(libCtx.x, 0, window.innerWidth - 210),
              top: clamp(libCtx.y, 0, window.innerHeight - 300),
              background: "rgba(10,10,24,0.98)", border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(20px)", minWidth: 190,
            }}
            onClick={e => e.stopPropagation()}>
            <p className="px-4 py-1.5 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider border-b border-white/[0.06] mb-1">Library ({me.libraryCount})</p>
            <ZoneMenuItem label="Draw"               onClick={() => { dispatch({ type: "DRAW" }); close() }} />
            <ZoneMenuItem label="Scry / Surveil…"    onClick={() => { setShowScry(true); close() }} />
            <ZoneMenuItem label="Mill…"              onClick={() => { setShowMill(true); close() }} />
            <div className="h-px mx-3 my-1 bg-white/[0.06]" />
            <ZoneMenuItem label="Exile Top"          onClick={() => moveTop("exile")} />
            <ZoneMenuItem label="Top to Graveyard"   onClick={() => moveTop("graveyard")} />
            <ZoneMenuItem label="Top to Battlefield" onClick={() => moveTop("battlefield")} />
            <div className="h-px mx-3 my-1 bg-white/[0.06]" />
            <ZoneMenuItem label="Search / View"      onClick={() => { setShowLibrary(true); close() }} />
            <ZoneMenuItem label="Shuffle"            onClick={() => { dispatch({ type: "SHUFFLE" }); close() }} />
          </div>
        )
      })()}

      {/* ── Zone modals ───────────────────────────────────────────────────────── */}
      {showGY && (
        <ZoneModal title="Graveyard" icon={<Flame className="w-4 h-4 text-red-400" />}
          cards={me.graveyard} emptyText="Graveyard is empty"
          onClose={() => setShowGY(false)} onAction={dispatch} onZoom={setZoomed} />
      )}
      {showExile && (
        <ZoneModal title="Exile" icon={<Sparkles className="w-4 h-4 text-violet-400" />}
          cards={me.exile} emptyText="Nothing in exile"
          onClose={() => setShowExile(false)} onAction={dispatch} onZoom={setZoomed} />
      )}
      {showLibrary && (
        <ZoneModal title="Library" icon={<BookOpen className="w-4 h-4 text-indigo-400" />}
          cards={me.library} emptyText="Library is empty"
          onClose={() => setShowLibrary(false)} onAction={dispatch} onZoom={setZoomed}
          extraActions={
            <button onClick={() => dispatch({ type: "SHUFFLE" })}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.07] transition-colors">
              <Shuffle className="w-3 h-3" /> Shuffle
            </button>
          } />
      )}
      {showScry && me.library.length > 0 && (
        <ScryModal library={me.library}
          onResolve={(top, bottom, graveyard) => dispatch({ type: "SCRY_RESOLVE", top, bottom, graveyard })}
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

      {/* Hover-to-enlarge preview (renders via portal) */}
      {hoverPreview}

      {/* ── Zoom ──────────────────────────────────────────────────────────────── */}
      {zoomed && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80"
          onClick={() => setZoomed(null)}>
          <img src={scryfallImage(zoomed, "png")} alt="" className="max-h-[85vh] rounded-xl shadow-2xl" draggable={false} />
          <button onClick={() => setZoomed(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}
