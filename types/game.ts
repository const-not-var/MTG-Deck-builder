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
  /** Normalized battlefield position of the card's CENTER (0..1 of board w/h), synced so every player sees the same arrangement */
  x?: number
  y?: number
  /** Stacking order — the most recently moved/played card gets the highest z so it sits on top */
  z?: number
  /** DFC/transform: when true, render imageUriBack (the other face) */
  flipped?: boolean
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
  /** Player-level counters tracked on the player, not a permanent (poison, energy, experience, …) */
  playerCounters: Record<string, number>
  /** Number of London mulligans taken this game — determines how many cards must be bottomed on keep */
  mulligans: number
  /** True once this player has locked in their opening hand (ends their mulligan phase) */
  kept: boolean
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
  status: "lobby" | "mulligan" | "active" | "ended"
  hostUserId: string
  maxPlayers: number
  /** seatIndex of the monarch / initiative holder, or null if nobody holds it */
  monarch: number | null
  initiative: number | null
  /** House rule: first mulligan doesn't count toward cards bottomed */
  freeMulligan: boolean
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
  | { type: "MOVE"; instanceId: string; fromZone: Zone; toZone: Zone; x?: number; y?: number }
  | { type: "MOVE_TO_TOP"; instanceId: string; fromZone: Zone }
  | { type: "ADJUST_LIFE"; delta: number }
  | { type: "RECORD_CMD_DAMAGE"; fromSeat: number; amount: number }
  | { type: "NEXT_PHASE" }
  | { type: "ADD_COUNTER"; instanceId: string; counterName: string; delta: number }
  | { type: "CAST_COMMANDER"; instanceId: string; x?: number; y?: number }
  | { type: "ADJUST_CMD_TAX"; name: string; delta: number }
  | { type: "SHUFFLE" }
  | { type: "MILL"; count: number }
  | { type: "SCRY_BOTTOM"; instanceId: string }
  // Resolve a scry/surveil: reorder the looked-at top cards into top/bottom/graveyard
  | { type: "SCRY_RESOLVE"; top: string[]; bottom: string[]; graveyard: string[] }
  // Monarch / initiative (game-level; null clears)
  | { type: "SET_MONARCH"; seat: number | null }
  | { type: "SET_INITIATIVE"; seat: number | null }
  | { type: "SET_FREE_MULLIGAN"; value: boolean }
  | { type: "CHAT"; text: string }
  | { type: "CREATE_TOKEN"; instanceId: string; name: string; typeLine: string; colorIdentity: string[] }
  // ── Battlefield position (normalized 0..1 center) ──
  | { type: "SET_POSITION"; instanceId: string; x: number; y: number }
  // ── DFC / copies / counters ──
  | { type: "FLIP"; instanceId: string }
  | { type: "COPY"; instanceId: string; newInstanceId: string }
  | { type: "PROLIFERATE" }
  | { type: "ADJUST_PLAYER_COUNTER"; counterName: string; delta: number }
  // ── Game lifecycle / mulligan ──
  | { type: "START_GAME" }
  | { type: "MULLIGAN" }
  | { type: "KEEP_HAND"; bottom: string[] }
  | { type: "FORCE_START" }
