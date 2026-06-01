export type GamePhase = "untap" | "upkeep" | "draw" | "main1" | "combat" | "main2" | "end"
export type Zone = "hand" | "library" | "battlefield" | "graveyard" | "exile" | "commandZone"

export interface GameCard {
  instanceId: string
  scryfallId: string
  name: string
  imageUri: string
  imageUriBack?: string
  typeLine: string
  oracleText?: string
  manaCost: string
  cmc: number
  colorIdentity: string[]
  tapped: boolean
  counters: Record<string, number>
  isCopy?: boolean
  loyalty?: string
}

export interface PlayerState {
  userId: string
  userName: string
  seatIndex: number
  deckId: string
  life: number
  /** "seatIndex" → cumulative commander damage from that seat's commander */
  commanderDamage: Record<string, number>
  hand: GameCard[]
  libraryCount: number
  library: GameCard[]
  battlefield: GameCard[]
  graveyard: GameCard[]
  exile: GameCard[]
  commandZone: GameCard[]
  cmdCastCount: Record<string, number>
  joined: boolean
}

export interface ChatMessage {
  seatIndex: number
  userName: string
  text: string
  ts: number
}

export interface GameState {
  _id: string
  code: string
  status: "lobby" | "active" | "ended"
  hostUserId: string
  maxPlayers: number
  players: PlayerState[]
  chat: ChatMessage[]
  turn: {
    currentSeat: number
    phase: GamePhase
    number: number
  }
  createdAt: string
  updatedAt: string
}

export type GameAction =
  | { type: "DRAW"; count?: number }
  | { type: "TAP"; instanceId: string }
  | { type: "UNTAP_ALL" }
  | { type: "MOVE"; instanceId: string; fromZone: Zone; toZone: Zone }
  | { type: "ADJUST_LIFE"; delta: number }
  | { type: "RECORD_CMD_DAMAGE"; fromSeat: number; amount: number }
  | { type: "NEXT_PHASE" }
  | { type: "ADD_COUNTER"; instanceId: string; counterName: string; delta: number }
  | { type: "CAST_COMMANDER"; instanceId: string }
  | { type: "SHUFFLE" }
  | { type: "START_GAME" }
  | { type: "CHAT"; text: string }
