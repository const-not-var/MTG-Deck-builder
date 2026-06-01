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

type MutablePlayer = {
  userId: string; userName: string; seatIndex: number; deckId: string
  life: number; commanderDamage: Record<string, number>
  hand: GameCard[]; library: GameCard[]; libraryCount: number
  battlefield: GameCard[]; graveyard: GameCard[]; exile: GameCard[]
  commandZone: GameCard[]; cmdCastCount: Record<string, number>; joined: boolean
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
      const toArr = getZone(player, action.toZone)
      const destCard: GameCard = { ...card, tapped: false }
      setZone(player, action.toZone, [...toArr, destCard])
      if (action.fromZone === "library" || action.toZone === "library") {
        player.libraryCount = player.library.length
      }
      return updated()
    }

    case "ADJUST_LIFE": {
      player.life = Math.max(0, player.life + action.delta)
      return updated()
    }

    case "RECORD_CMD_DAMAGE": {
      const key = String(action.fromSeat)
      player.commanderDamage[key] = (player.commanderDamage[key] ?? 0) + action.amount
      player.life = Math.max(0, player.life - action.amount)
      return updated()
    }

    case "CAST_COMMANDER": {
      const cmdIdx = player.commandZone.findIndex(c => c.instanceId === action.instanceId)
      if (cmdIdx === -1) return game
      const [cmd] = player.commandZone.splice(cmdIdx, 1)
      player.cmdCastCount[cmd.name] = (player.cmdCastCount[cmd.name] ?? 0) + 1
      player.battlefield = [...player.battlefield, { ...cmd, tapped: false }]
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
      player.library = [{ ...card, tapped: false }, ...player.library]
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
      player.battlefield = [...player.battlefield, token]
      return updated()
    }

    case "SCRY_BOTTOM": {
      const cardIdx = player.library.findIndex(c => c.instanceId === action.instanceId)
      if (cardIdx === -1) return game
      const [card] = player.library.splice(cardIdx, 1)
      player.library = [...player.library, card]
      return updated()
    }

    case "NEXT_PHASE": {
      const idx = PHASES.indexOf(game.turn.phase)
      const nextPhase = PHASES[(idx + 1) % PHASES.length]
      if (nextPhase === "untap") {
        const seats = game.players.filter(p => p.joined).map(p => p.seatIndex).sort((a, b) => a - b)
        const ci = seats.indexOf(game.turn.currentSeat)
        const nextSeat = seats[(ci + 1) % seats.length]
        return updated({ turn: { currentSeat: nextSeat, phase: "untap", number: game.turn.number + 1 } })
      }
      return updated({ turn: { ...game.turn, phase: nextPhase } })
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
      if (game.hostUserId !== userId || game.status !== "lobby") return game
      const ready = game.players.filter(p => p.joined)
      if (ready.length < 2) return game
      const firstSeat = ready.sort((a, b) => a.seatIndex - b.seatIndex)[0].seatIndex
      return updated({ status: "active", turn: { currentSeat: firstSeat, phase: "main1", number: 1 } })
    }

    default:
      return game
  }
}
