"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Copy, Check, Loader2, Users, Play, Crown, ArrowLeft,
  Send, X, ChevronRight, Shuffle, RotateCcw,
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
const CW = 80
const CH = 112

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniCard({ card, onClick, onContextMenu, dimmed }: {
  card: GameCard
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  dimmed?: boolean
}) {
  return (
    <div
      className="relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl"
      style={{
        width: CW, height: CH,
        opacity: dimmed ? 0.5 : 1,
        transform: card.tapped ? "rotate(90deg)" : undefined,
        transition: "transform 0.2s ease",
        border: card.tapped ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.1)",
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {card.imageUri ? (
        <img src={card.imageUri} alt={card.name} className="w-full h-full object-cover object-top" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1 text-center"
          style={{ background: "#1a1a2e" }}>
          <span className="text-[8px] text-zinc-400 leading-tight">{card.name}</span>
        </div>
      )}
      {Object.entries(card.counters).filter(([, v]) => v > 0).length > 0 && (
        <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
          {Object.entries(card.counters).filter(([, v]) => v > 0).map(([name, val]) => (
            <div key={name} className="text-[8px] font-black px-1 rounded-full leading-none py-0.5"
              style={{ background: "#22c55e", color: "#fff" }}>
              {name === "+1/+1" ? "+" : name.slice(0, 2)}×{val}
            </div>
          ))}
        </div>
      )}
      {card.tapped && (
        <div className="absolute inset-0 rounded-lg ring-1 ring-amber-500/30" />
      )}
    </div>
  )
}

function CardBack({ width = CW, height = CH }: { width?: number; height?: number }) {
  return (
    <div className="rounded-lg flex-shrink-0"
      style={{
        width, height,
        background: "linear-gradient(135deg, #1a1a3e, #0d0d22)",
        border: "1px solid rgba(99,102,241,0.3)",
      }} />
  )
}

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

function OpponentZone({ player, myCommanders, onAdjustLife, onRecordCmdDmg }: {
  player: PlayerState
  myCommanders: GameCard[]
  onAdjustLife: (d: number) => void
  onRecordCmdDmg: (fromSeat: number, amount: number) => void
}) {
  const seatColor = SEAT_COLORS[player.seatIndex % 4]
  const commanders = player.commandZone.filter(c => /legendary.*creature|planeswalker/i.test(c.typeLine) || c.name)
  const cmdBfCards = player.battlefield.filter(c => /commander/i.test(c.typeLine) || commanders.some(cmd => cmd.scryfallId === c.scryfallId))

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl flex-1 min-w-0"
      style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${seatColor}25` }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seatColor }} />
          <span className="text-xs font-bold text-zinc-200 truncate">{player.userName}</span>
          <span className="text-[10px] text-zinc-600 flex-shrink-0">{player.libraryCount}L</span>
          <span className="text-[10px] text-zinc-600 flex-shrink-0">{player.hand.length}H</span>
        </div>
        <LifeCounter life={player.life} seat={player.seatIndex} onAdjust={onAdjustLife} />
      </div>

      {/* Commander damage from my commanders */}
      {myCommanders.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {myCommanders.map(cmd => {
            const key = String(player.seatIndex)
            const dmg = player.commanderDamage?.[key] ?? 0
            return (
              <div key={cmd.instanceId} className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400/60" />
                <span className="text-[10px] text-zinc-500">{cmd.name.split(" ")[0]}:</span>
                <button onClick={() => onRecordCmdDmg(player.seatIndex, 1)} className="text-[10px] font-bold text-red-400 hover:text-red-300 px-1">+</button>
                <span className="text-[10px] font-bold text-zinc-300 tabular-nums">{dmg}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Command Zone */}
      {player.commandZone.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {player.commandZone.map(c => <MiniCard key={c.instanceId} card={c} />)}
        </div>
      )}

      {/* Hand (face down) */}
      {player.hand.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {player.hand.map((_, i) => <CardBack key={i} width={40} height={56} />)}
        </div>
      )}

      {/* Battlefield */}
      {player.battlefield.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {player.battlefield.map(c => <MiniCard key={c.instanceId} card={c} dimmed={c.tapped} />)}
        </div>
      )}

      <div className="flex items-center gap-3 text-[9px] text-zinc-700 mt-auto">
        <span>GY: {player.graveyard.length}</span>
        <span>Exile: {player.exile.length}</span>
      </div>
    </div>
  )
}

function ChatPanel({ messages, userName, onSend }: {
  messages: { seatIndex: number; userName: string; text: string; ts: number }[]
  userName: string
  onSend: (text: string) => void
}) {
  const [input, setInput] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const send = () => {
    const t = input.trim()
    if (!t) return
    onSend(t)
    setInput("")
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "rgba(6,7,22,0.95)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="px-3 py-2 border-b border-white/[0.05] flex-shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Chat</p>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ scrollbarWidth: "thin" }}>
        {messages.length === 0 && (
          <p className="text-[10px] text-zinc-700 text-center pt-4">No messages yet</p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <span className="text-[10px] font-bold" style={{ color: SEAT_COLORS[m.seatIndex % 4] }}>{m.userName}: </span>
            <span className="text-[11px] text-zinc-300">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="px-2 py-2 border-t border-white/[0.05] flex gap-1.5 flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/40"
        />
        <button onClick={send} disabled={!input.trim()}
          className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; instanceId: string; zone: Zone }

function CardContextMenu({ menu, myPlayer, onAction, onClose }: {
  menu: CtxMenu
  myPlayer: PlayerState
  onAction: (a: GameAction) => void
  onClose: () => void
}) {
  const card = [...myPlayer.hand, ...myPlayer.battlefield, ...myPlayer.graveyard, ...myPlayer.exile, ...myPlayer.commandZone]
    .find(c => c.instanceId === menu.instanceId)
  if (!card) return null

  const move = (to: Zone) => { onAction({ type: "MOVE", instanceId: menu.instanceId, fromZone: menu.zone, toZone: to }); onClose() }
  const isLegendaryCreature = /legendary.*creature/i.test(card.typeLine)

  return (
    <div
      className="fixed z-[200] py-1 rounded-xl shadow-2xl"
      style={{
        left: Math.min(menu.x, window.innerWidth - 200),
        top: Math.min(menu.y, window.innerHeight - 240),
        background: "rgba(10,10,24,0.98)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        minWidth: 180,
      }}
      onClick={e => e.stopPropagation()}
    >
      <p className="px-4 py-1.5 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider truncate border-b border-white/[0.06] mb-1">{card.name}</p>
      {menu.zone === "hand" && <>
        <MenuItem label="Play to Battlefield" onClick={() => move("battlefield")} />
        <MenuItem label="Discard (GY)" onClick={() => move("graveyard")} />
        <MenuItem label="Exile" onClick={() => move("exile")} />
        <MenuItem label="Put on top of Library" onClick={() => move("library")} />
      </>}
      {menu.zone === "battlefield" && <>
        <MenuItem label={card.tapped ? "Untap" : "Tap"} onClick={() => { onAction({ type: "TAP", instanceId: menu.instanceId }); onClose() }} />
        <div className="h-px mx-3 my-1 bg-white/[0.06]" />
        <MenuItem label="Send to Graveyard" onClick={() => move("graveyard")} />
        <MenuItem label="Exile" onClick={() => move("exile")} />
        <MenuItem label="Return to Hand" onClick={() => move("hand")} />
        {isLegendaryCreature && <MenuItem label="Return to Command Zone" onClick={() => move("commandZone")} />}
        <div className="h-px mx-3 my-1 bg-white/[0.06]" />
        <MenuItem label="+1/+1 counter" onClick={() => { onAction({ type: "ADD_COUNTER", instanceId: menu.instanceId, counterName: "+1/+1", delta: 1 }); onClose() }} />
        <MenuItem label="Remove +1/+1" onClick={() => { onAction({ type: "ADD_COUNTER", instanceId: menu.instanceId, counterName: "+1/+1", delta: -1 }); onClose() }} />
      </>}
      {menu.zone === "graveyard" && <>
        <MenuItem label="Return to Hand" onClick={() => move("hand")} />
        <MenuItem label="Put on Battlefield" onClick={() => move("battlefield")} />
        <MenuItem label="Exile" onClick={() => move("exile")} />
      </>}
      {menu.zone === "exile" && <>
        <MenuItem label="Return to Hand" onClick={() => move("hand")} />
        <MenuItem label="Send to Graveyard" onClick={() => move("graveyard")} />
      </>}
      {menu.zone === "commandZone" && <>
        <MenuItem label="Cast (Play to Battlefield)" onClick={() => { onAction({ type: "CAST_COMMANDER", instanceId: menu.instanceId }); onClose() }} />
      </>}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left px-4 py-2 text-xs text-zinc-200 hover:bg-white/[0.07] transition-colors">
      {label}
    </button>
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/game/${code}`)
      if (res.ok) {
        const data = await res.json()
        setGame(data.game)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [code])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(() => poll(true), 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [poll])

  const dispatch = useCallback(async (action: GameAction) => {
    // Optimistically apply common state changes locally
    setGame(prev => {
      if (!prev) return prev
      const playerIdx = prev.players.findIndex(p => p.userId === userId)
      if (playerIdx === -1) return prev
      const player = JSON.parse(JSON.stringify(prev.players[playerIdx]))
      let turn = { ...prev.turn }

      if (action.type === "TAP") {
        player.battlefield = player.battlefield.map((c: GameCard) =>
          c.instanceId === action.instanceId ? { ...c, tapped: !c.tapped } : c
        )
      } else if (action.type === "DRAW") {
        const count = Math.min(action.count ?? 1, player.library.length)
        const drawn = player.library.splice(0, count)
        player.hand = [...player.hand, ...drawn]
        player.libraryCount = player.library.length
      } else if (action.type === "UNTAP_ALL") {
        player.battlefield = player.battlefield.map((c: GameCard) => ({ ...c, tapped: false }))
      } else if (action.type === "ADJUST_LIFE") {
        player.life = Math.max(0, player.life + action.delta)
      } else if (action.type === "NEXT_PHASE") {
        const idx = PHASES.findIndex(p => p.id === prev.turn.phase)
        const nextPhase = PHASES[(idx + 1) % PHASES.length].id
        if (nextPhase === "untap") {
          const seats = prev.players.filter(p => p.joined).map(p => p.seatIndex).sort((a, b) => a - b)
          const ci = seats.indexOf(prev.turn.currentSeat)
          turn = { currentSeat: seats[(ci + 1) % seats.length], phase: "untap", number: prev.turn.number + 1 }
        } else {
          turn = { ...prev.turn, phase: nextPhase }
        }
      }

      return {
        ...prev,
        players: prev.players.map((p, i) => i === playerIdx ? player : p),
        turn,
      }
    })

    // Send to server (fire-and-forget; next poll reconciles)
    fetch(`/api/game/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {})
  }, [code, userId])

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeCtx = useCallback(() => setCtxMenu(null), [])

  // ── Derived state ──────────────────────────────────────────────────────────
  const me = game?.players.find(p => p.userId === userId) ?? null
  const opponents = game?.players.filter(p => p.userId !== userId) ?? []
  const myCommanders = me?.commandZone.filter(c =>
    /legendary.*creature|planeswalker/i.test(c.typeLine)
  ) ?? []
  const isMyTurn = game?.turn.currentSeat === me?.seatIndex
  const currentPhase = PHASES.find(p => p.id === game?.turn.phase)
  const isHost = game?.hostUserId === userId

  // ── Loading ────────────────────────────────────────────────────────────────
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

  // ── Lobby screen ───────────────────────────────────────────────────────────
  if (game.status === "lobby") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6" style={{ background: "#06071c" }}>
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Waiting for Players</h1>
            <p className="text-sm text-zinc-500 mt-1">Share the code below to invite friends</p>
          </div>

          {/* Invite code */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <span className="text-3xl font-black tracking-[0.3em] text-amber-400 font-mono">{code}</span>
              <button onClick={copyCode} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Players */}
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{game.players.filter(p => p.joined).length} / {game.maxPlayers} Players</span>
            </div>
            {game.players.filter(p => p.joined).map(p => (
              <div key={p.userId} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEAT_COLORS[p.seatIndex % 4] }} />
                <span className="text-sm text-zinc-200">{p.userName}</span>
                {p.userId === game.hostUserId && (
                  <span className="text-[9px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded font-bold">HOST</span>
                )}
                {p.userId === userId && (
                  <span className="text-[9px] text-zinc-500">(you)</span>
                )}
              </div>
            ))}
            {game.players.filter(p => p.joined).length < 2 && (
              <p className="text-xs text-zinc-600 mt-2">Waiting for at least one more player…</p>
            )}
          </div>

          {isHost && (
            <button
              onClick={() => dispatch({ type: "START_GAME" })}
              disabled={game.players.filter(p => p.joined).length < 2}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-40 transition-colors shadow-lg shadow-amber-500/25"
            >
              <Play className="w-4 h-4" />
              Start Game
            </button>
          )}
          {!isHost && (
            <p className="text-center text-xs text-zinc-600">Waiting for the host to start the game…</p>
          )}

          <button onClick={() => router.push("/game")} className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Leave game
          </button>
        </div>
      </div>
    )
  }

  // ── Active game table ──────────────────────────────────────────────────────
  if (!me) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#06071c" }}>
        <p className="text-zinc-400">You are not a player in this game.</p>
      </div>
    )
  }

  const openCtx = (e: React.MouseEvent, instanceId: string, zone: Zone) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, instanceId, zone })
  }

  return (
    <div className="fixed inset-0 flex flex-col select-none overflow-hidden"
      style={{ background: "#07071a" }}
      onClick={closeCtx}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-11 flex-shrink-0 border-b border-white/[0.05]"
        style={{ background: "rgba(6,7,28,0.98)" }}>

        <button onClick={() => router.push("/game")} className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-white/[0.07]" />

        {/* Phase tracker */}
        <div className="flex items-center gap-0.5">
          {PHASES.map(ph => {
            const active = game.turn.phase === ph.id
            return (
              <button key={ph.id}
                onClick={e => { e.stopPropagation(); dispatch({ type: "NEXT_PHASE" }) }}
                title={ph.label}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all"
                style={{
                  background: active ? `${ph.color}22` : "transparent",
                  color: active ? ph.color : "rgba(255,255,255,0.2)",
                  border: `1px solid ${active ? ph.color : "transparent"}`,
                }}>
                {ph.short}
              </button>
            )
          })}
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: "NEXT_PHASE" }) }}
            className="ml-1 w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-white/[0.08] text-xs font-bold transition-colors"
            title="Next phase">→</button>
        </div>

        <div className="w-px h-5 bg-white/[0.07]" />

        {/* Current turn indicator */}
        <span className="text-[10px] text-zinc-500 flex-shrink-0">
          Turn {game.turn.number} ·{" "}
          <span style={{ color: SEAT_COLORS[game.turn.currentSeat % 4] }}>
            {game.players.find(p => p.seatIndex === game.turn.currentSeat)?.userName ?? "?"}
          </span>
          {isMyTurn && <span className="text-amber-400"> (you)</span>}
        </span>

        <div className="flex-1" />

        {/* Your life */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-600">Life</span>
          <LifeCounter life={me.life} seat={me.seatIndex} onAdjust={d => dispatch({ type: "ADJUST_LIFE", delta: d })} />
        </div>

        <div className="w-px h-5 bg-white/[0.07]" />

        {/* Quick actions */}
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "DRAW" }) }}
          className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">
          Draw
        </button>
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "UNTAP_ALL" }) }}
          className="px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">
          Untap All
        </button>
        <button onClick={e => { e.stopPropagation(); dispatch({ type: "SHUFFLE" }) }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded transition-colors">
          <Shuffle className="w-3 h-3" />
        </button>

        <div className="w-px h-5 bg-white/[0.07]" />

        <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0">{code}</span>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: game area ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Opponents */}
          {opponents.length > 0 && (
            <div className="flex gap-2 p-2 flex-shrink-0 overflow-x-auto" style={{ maxHeight: 280, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {opponents.map(opp => (
                <OpponentZone
                  key={opp.userId}
                  player={opp}
                  myCommanders={myCommanders}
                  onAdjustLife={d => {
                    // Record in their state — we dispatch from our own player perspective
                    // This adjusts their displayed life (server reconciles)
                    setGame(prev => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        players: prev.players.map(p =>
                          p.userId === opp.userId ? { ...p, life: Math.max(0, p.life + d) } : p
                        ),
                      }
                    })
                  }}
                  onRecordCmdDmg={(_fromSeat, amount) => {
                    dispatch({ type: "RECORD_CMD_DAMAGE", fromSeat: me.seatIndex, amount })
                  }}
                />
              ))}
            </div>
          )}

          {/* Battlefield + Command Zone */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Your Battlefield</span>
              <span className="text-[9px] text-zinc-700 ml-auto">Lib: {me.libraryCount} · GY: {me.graveyard.length} · Exile: {me.exile.length}</span>
            </div>

            {/* Command Zone (always visible) */}
            {me.commandZone.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(245,158,11,0.03)" }}>
                <Crown className="w-3 h-3 text-amber-500/60 flex-shrink-0" />
                <span className="text-[9px] text-amber-500/60 font-bold uppercase tracking-widest flex-shrink-0">Command Zone</span>
                <div className="flex gap-2 flex-wrap">
                  {me.commandZone.map(c => (
                    <div key={c.instanceId} className="relative group/cmd">
                      <MiniCard card={c} onContextMenu={e => openCtx(e, c.instanceId, "commandZone")} />
                      <button
                        onClick={e => { e.stopPropagation(); dispatch({ type: "CAST_COMMANDER", instanceId: c.instanceId }) }}
                        className="absolute inset-x-0 bottom-0 bg-amber-500/90 text-zinc-950 text-[8px] font-black py-0.5 opacity-0 group-hover/cmd:opacity-100 transition-opacity rounded-b-lg">
                        CAST
                      </button>
                      {me.cmdCastCount[c.name] ? (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                          {me.cmdCastCount[c.name]}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Battlefield cards */}
            <div className="flex-1 overflow-y-auto p-3">
              {me.battlefield.length === 0 ? (
                <p className="text-xs text-zinc-800 text-center pt-8">Play cards from your hand to the battlefield</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {me.battlefield.map(c => (
                    <MiniCard
                      key={c.instanceId}
                      card={c}
                      onClick={() => dispatch({ type: "TAP", instanceId: c.instanceId })}
                      onContextMenu={e => openCtx(e, c.instanceId, "battlefield")}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hand */}
          <div className="flex-shrink-0 border-t border-white/[0.05]" style={{ background: "rgba(6,7,24,0.95)" }}>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Hand ({me.hand.length})</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 overflow-x-auto" style={{ scrollbarWidth: "thin", minHeight: CH + 20 }}>
              {me.hand.length === 0 ? (
                <span className="text-xs text-zinc-700">Empty hand</span>
              ) : me.hand.map(c => (
                <div key={c.instanceId} className="flex-shrink-0 group/hand relative">
                  <div className="transition-transform duration-150 group-hover/hand:-translate-y-3">
                    <MiniCard
                      card={c}
                      onClick={() => dispatch({ type: "MOVE", instanceId: c.instanceId, fromZone: "hand", toZone: "battlefield" })}
                      onContextMenu={e => openCtx(e, c.instanceId, "hand")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: chat ──────────────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col min-h-0">
          <ChatPanel
            messages={game.chat}
            userName={userName}
            onSend={text => dispatch({ type: "CHAT", text })}
          />
        </div>
      </div>

      {/* ── Context menu ─────────────────────────────────────────────────── */}
      {ctxMenu && (
        <CardContextMenu
          menu={ctxMenu}
          myPlayer={me}
          onAction={dispatch}
          onClose={closeCtx}
        />
      )}

      {/* ── Zoom overlay ─────────────────────────────────────────────────── */}
      {zoomed && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80"
          onClick={() => setZoomed(null)}>
          <img src={zoomed} alt="" className="max-h-[80vh] rounded-xl shadow-2xl" />
          <button onClick={() => setZoomed(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}
