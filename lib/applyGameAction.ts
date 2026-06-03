import type { GameCard, GameState, GameAction, Zone, GamePhase } from "@/types/game"

const PHASES: GamePhase[] = ["untap", "upkeep", "draw", "main1", "combat", "main2", "end"]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isPlaneswalker(card: GameCard): boolean {
  return /planeswalker/i.test(card.typeLine)
}

// Tokens and copies cease to exist when they leave the battlefield.
function isEphemeral(card: GameCard): boolean {
  return card.scryfallId?.startsWith("token-") === true || card.isCopy === true
}

function clamp01(v: number): number { return Math.max(0.05, Math.min(0.95, v)) }

// Next stacking order above everything currently on the battlefield.
function topZ(battlefield: GameCard[]): number {
  return battlefield.reduce((m, c) => Math.max(m, c.z ?? 0), 0) + 1
}

// Find a free normalized (0..1) spot for a card entering the battlefield, spiralling
// out from center. Positions are normalized so every viewer renders the same layout
// regardless of their board size.
function placeBF(existing: GameCard[]): { x: number; y: number } {
  const SX = 0.085, SY = 0.15
  const taken = existing
    .filter(c => typeof c.x === "number" && typeof c.y === "number")
    .map(c => ({ x: c.x as number, y: c.y as number }))
  const hit = (x: number, y: number) => taken.some(p => Math.abs(p.x - x) < SX * 0.9 && Math.abs(p.y - y) < SY * 0.9)
  if (!hit(0.5, 0.5)) return { x: 0.5, y: 0.5 }
  for (let r = 1; r <= 8; r++) {
    for (let c = -r; c <= r; c++) {
      for (let rw = -r; rw <= r; rw++) {
        if (Math.abs(c) !== r && Math.abs(rw) !== r) continue
        const x = clamp01(0.5 + c * SX), y = clamp01(0.5 + rw * SY)
        if (!hit(x, y)) return { x, y }
      }
    }
  }
  return { x: 0.5, y: 0.5 }
}

/**
 * Normalize a card entering the battlefield: it's a fresh object, so it enters
 * untapped, unflipped, with no counters (except a planeswalker, which enters with
 * its starting loyalty), and gets a free normalized board position.
 */
function enterBattlefield(card: GameCard, existing: GameCard[]): GameCard {
  const loy = card.loyalty ? parseInt(card.loyalty) : NaN
  const counters: Record<string, number> =
    isPlaneswalker(card) && !isNaN(loy) ? { loyalty: loy } : {}
  const pos = placeBF(existing)
  return { ...card, tapped: false, flipped: false, counters, x: pos.x, y: pos.y, z: topZ(existing) }
}

type MutablePlayer = {
  userId: string; userName: string; seatIndex: number; deckId: string
  life: number; commanderDamage: Record<string, number>
  hand: GameCard[]; library: GameCard[]; libraryCount: number
  battlefield: GameCard[]; graveyard: GameCard[]; exile: GameCard[]
  commandZone: GameCard[]; cmdCastCount: Record<string, number>
  playerCounters: Record<string, number>; mulligans: number; kept: boolean
  joined: boolean
}

function getZone(p: MutablePlayer, zone: Zone): GameCard[] {
  return p[zone as keyof MutablePlayer] as GameCard[]
}

function setZone(p: MutablePlayer, zone: Zone, cards: GameCard[]): void {
  (p as Record<string, unknown>)[zone] = cards
}

export function applyAction(game: GameState, userId: string, action: GameAction): GameState {
  const playerIdx = game.players.findIndex(p => p.userId === userId)
  if (playerIdx === -1) return game

  const player: MutablePlayer = JSON.parse(JSON.stringify(game.players[playerIdx]))
  const updated = (extra?: Partial<GameState>): GameState => ({
    ...game,
    players: game.players.map((p, i) => i === playerIdx ? player : p),
    updatedAt: new Date().toISOString(),
    ...extra,
  })

  switch (action.type) {
    case "DRAW": {
      const count = Math.min(action.count ?? 1, player.library.length)
      const drawn = player.library.splice(0, count)
      player.hand = [...player.hand, ...drawn]
      player.libraryCount = player.library.length
      return updated()
    }

    case "TAP": {
      player.battlefield = player.battlefield.map(c =>
        c.instanceId === action.instanceId ? { ...c, tapped: !c.tapped } : c
      )
      return updated()
    }

    case "UNTAP_ALL": {
      player.battlefield = player.battlefield.map(c => ({ ...c, tapped: false }))
      return updated()
    }

    case "MOVE": {
      const fromArr = getZone(player, action.fromZone)
      const cardIdx = fromArr.findIndex(c => c.instanceId === action.instanceId)
      if (cardIdx === -1) return game
      const [card] = fromArr.splice(cardIdx, 1)
      setZone(player, action.fromZone, fromArr)
      // Tokens/copies vanish when they leave the battlefield rather than moving.
      if (isEphemeral(card) && action.toZone !== "battlefield") {
        if (action.fromZone === "library") player.libraryCount = player.library.length
        return updated()
      }
      const toArr = getZone(player, action.toZone)
      let destCard: GameCard
      if (action.toZone === "battlefield") {
        destCard = enterBattlefield(card, player.battlefield)
        if (typeof action.x === "number" && typeof action.y === "number") destCard = { ...destCard, x: action.x, y: action.y }
      } else {
        destCard = { ...card, tapped: false, flipped: false }
      }
      setZone(player, action.toZone, [...toArr, destCard])
      if (action.fromZone === "library" || action.toZone === "library") {
        player.libraryCount = player.library.length
      }
      return updated()
    }

    case "ADJUST_LIFE": {
      // You can only change your own life.
      player.life = Math.max(0, player.life + action.delta)
      return updated()
    }

    case "RECORD_CMD_DAMAGE": {
      // Defender-centric: I record commander damage taken from `fromSeat`'s commander
      // on myself, and lose that much life. Nobody can edit anyone else's totals.
      const key = String(action.fromSeat)
      player.commanderDamage[key] = Math.max(0, (player.commanderDamage[key] ?? 0) + action.amount)
      player.life = Math.max(0, player.life - action.amount)
      return updated()
    }

    case "CAST_COMMANDER": {
      const cmdIdx = player.commandZone.findIndex(c => c.instanceId === action.instanceId)
      if (cmdIdx === -1) return game
      const [cmd] = player.commandZone.splice(cmdIdx, 1)
      // Casting auto-increments commander tax; it can still be corrected with ADJUST_CMD_TAX.
      player.cmdCastCount[cmd.name] = (player.cmdCastCount[cmd.name] ?? 0) + 1
      let bfCmd = enterBattlefield(cmd, player.battlefield)
      if (typeof action.x === "number" && typeof action.y === "number") bfCmd = { ...bfCmd, x: action.x, y: action.y }
      player.battlefield = [...player.battlefield, bfCmd]
      return updated()
    }

    case "SHUFFLE": {
      player.library = shuffle(player.library)
      return updated()
    }

    case "MILL": {
      const count = Math.min(action.count, player.library.length)
      const milled = player.library.splice(0, count)
      player.graveyard = [...player.graveyard, ...milled]
      player.libraryCount = player.library.length
      return updated()
    }

    case "MOVE_TO_TOP": {
      const fromArr = getZone(player, action.fromZone)
      const cardIdx = fromArr.findIndex(c => c.instanceId === action.instanceId)
      if (cardIdx === -1) return game
      const [card] = fromArr.splice(cardIdx, 1)
      setZone(player, action.fromZone, fromArr)
      // Tokens/copies vanish instead of going onto the library.
      if (isEphemeral(card)) {
        player.libraryCount = player.library.length
        return updated()
      }
      player.library = [{ ...card, tapped: false, flipped: false }, ...player.library]
      player.libraryCount = player.library.length
      return updated()
    }

    case "ADD_COUNTER": {
      player.battlefield = player.battlefield.map(c =>
        c.instanceId === action.instanceId
          ? { ...c, counters: { ...c.counters, [action.counterName]: Math.max(0, (c.counters[action.counterName] ?? 0) + action.delta) } }
          : c)
      return updated()
    }

    case "CREATE_TOKEN": {
      const token: GameCard = {
        instanceId: action.instanceId,
        scryfallId: `token-${action.instanceId}`,
        name: action.name,
        imageUri: "",
        typeLine: action.typeLine,
        oracleText: "",
        manaCost: "",
        cmc: 0,
        colorIdentity: action.colorIdentity,
        tapped: false,
        counters: {},
      }
      const tokenPos = placeBF(player.battlefield)
      token.x = tokenPos.x
      token.y = tokenPos.y
      token.z = topZ(player.battlefield)
      player.battlefield = [...player.battlefield, token]
      return updated()
    }

    case "SET_POSITION": {
      // Moving a card brings it to the top of the stack (last moved = on top).
      const z = topZ(player.battlefield.filter(c => c.instanceId !== action.instanceId))
      player.battlefield = player.battlefield.map(c =>
        c.instanceId === action.instanceId ? { ...c, x: action.x, y: action.y, z } : c)
      return updated()
    }

    case "FLIP": {
      player.battlefield = player.battlefield.map(c =>
        c.instanceId === action.instanceId ? { ...c, flipped: !c.flipped } : c)
      return updated()
    }

    case "COPY": {
      const src = player.battlefield.find(c => c.instanceId === action.instanceId)
      if (!src) return game
      const copy: GameCard = { ...enterBattlefield(src, player.battlefield), instanceId: action.newInstanceId, isCopy: true }
      player.battlefield = [...player.battlefield, copy]
      return updated()
    }

    case "PROLIFERATE": {
      player.battlefield = player.battlefield.map(c => {
        const active = Object.entries(c.counters).filter(([, v]) => v > 0)
        if (active.length === 0) return c
        const counters = { ...c.counters }
        for (const [name] of active) counters[name]++
        return { ...c, counters }
      })
      player.playerCounters = Object.fromEntries(
        Object.entries(player.playerCounters).map(([k, v]) => [k, v + 1]))
      return updated()
    }

    case "ADJUST_PLAYER_COUNTER": {
      const next = Math.max(0, (player.playerCounters[action.counterName] ?? 0) + action.delta)
      const counters = { ...player.playerCounters, [action.counterName]: next }
      if (next === 0) delete counters[action.counterName]
      player.playerCounters = counters
      return updated()
    }

    case "ADJUST_CMD_TAX": {
      const next = Math.max(0, (player.cmdCastCount[action.name] ?? 0) + action.delta)
      const counts = { ...player.cmdCastCount, [action.name]: next }
      if (next === 0) delete counts[action.name]
      player.cmdCastCount = counts
      return updated()
    }

    case "SCRY_BOTTOM": {
      const cardIdx = player.library.findIndex(c => c.instanceId === action.instanceId)
      if (cardIdx === -1) return game
      const [card] = player.library.splice(cardIdx, 1)
      player.library = [...player.library, card]
      return updated()
    }

    case "SCRY_RESOLVE": {
      // Reorder the looked-at top cards into top (kept order) / bottom / graveyard.
      const lookN = action.top.length + action.bottom.length + action.graveyard.length
      const looked = player.library.slice(0, lookN)
      const rest = player.library.slice(lookN)
      const byId = new Map(looked.map(c => [c.instanceId, c]))
      const pick = (ids: string[]) => ids.map(id => byId.get(id)).filter((c): c is GameCard => !!c)
      player.library = [...pick(action.top), ...rest, ...pick(action.bottom)]
      player.graveyard = [...player.graveyard, ...pick(action.graveyard)]
      player.libraryCount = player.library.length
      return updated()
    }

    case "NEXT_PHASE": {
      const idx = PHASES.indexOf(game.turn.phase)
      const nextPhase = PHASES[(idx + 1) % PHASES.length]
      if (nextPhase === "untap") {
        const seats = game.players.filter(p => p.joined).map(p => p.seatIndex).sort((a, b) => a - b)
        const ci = seats.indexOf(game.turn.currentSeat)
        const nextSeat = seats[(ci + 1) % seats.length]
        // The player whose turn begins untaps their permanents.
        return {
          ...game,
          players: game.players.map(p =>
            p.seatIndex === nextSeat
              ? { ...p, battlefield: p.battlefield.map(c => ({ ...c, tapped: false })) }
              : p),
          turn: { currentSeat: nextSeat, phase: "untap", number: game.turn.number + 1 },
          updatedAt: new Date().toISOString(),
        }
      }
      return {
        ...game,
        turn: { ...game.turn, phase: nextPhase },
        updatedAt: new Date().toISOString(),
      }
    }

    case "CHAT": {
      const msg = {
        seatIndex: player.seatIndex,
        userName: player.userName,
        text: action.text.slice(0, 500),
        ts: Date.now(),
      }
      return {
        ...game,
        players: game.players.map((p, i) => i === playerIdx ? player : p),
        chat: [...game.chat.slice(-200), msg],
        updatedAt: new Date().toISOString(),
      }
    }

    case "START_GAME": {
      // Host opens the mulligan phase; turn 1 begins once everyone keeps (or host force-starts).
      if (game.hostUserId !== userId || game.status !== "lobby") return game
      if (game.players.filter(p => p.joined).length < 2) return game
      return updated({ status: "mulligan" })
    }

    case "MULLIGAN": {
      // London mulligan: reshuffle the whole hand back, draw a fresh 7. Bottoming happens on keep.
      if (game.status !== "mulligan" || player.kept) return game
      const combined = shuffle([...player.hand, ...player.library])
      player.hand = combined.splice(0, 7)
      player.library = combined
      player.libraryCount = player.library.length
      player.mulligans += 1
      return updated()
    }

    case "KEEP_HAND": {
      // Bottom the chosen cards (count is trusted to the client) and lock in the hand.
      if (game.status !== "mulligan" || player.kept) return game
      const bottomSet = new Set(action.bottom)
      const bottomed = player.hand.filter(c => bottomSet.has(c.instanceId))
      player.hand = player.hand.filter(c => !bottomSet.has(c.instanceId))
      player.library = [...player.library, ...bottomed]
      player.libraryCount = player.library.length
      player.kept = true

      // Gate: once every joined player has kept, turn 1 begins.
      const players = game.players.map((p, i) => i === playerIdx ? player : p)
      const joined = players.filter(p => p.joined)
      if (joined.length >= 2 && joined.every(p => p.kept)) {
        const firstSeat = joined.map(p => p.seatIndex).sort((a, b) => a - b)[0]
        return {
          ...game,
          players,
          status: "active",
          turn: { currentSeat: firstSeat, phase: "main1", number: 1 },
          updatedAt: new Date().toISOString(),
        }
      }
      return updated()
    }

    case "FORCE_START": {
      // Host override: start turn 1 even if some players haven't kept (they keep their current hand).
      if (game.hostUserId !== userId || game.status !== "mulligan") return game
      const joined = game.players.filter(p => p.joined)
      if (joined.length < 2) return game
      const firstSeat = joined.map(p => p.seatIndex).sort((a, b) => a - b)[0]
      return updated({ status: "active", turn: { currentSeat: firstSeat, phase: "main1", number: 1 } })
    }

    case "SET_MONARCH":
      return { ...game, monarch: action.seat, updatedAt: new Date().toISOString() }

    case "SET_INITIATIVE":
      return { ...game, initiative: action.seat, updatedAt: new Date().toISOString() }

    case "SET_FREE_MULLIGAN":
      if (game.hostUserId !== userId) return game
      return { ...game, freeMulligan: action.value, updatedAt: new Date().toISOString() }

    default:
      return game
  }
}
