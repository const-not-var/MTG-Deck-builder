import { z } from "zod"

/** Parse a request body as JSON, returning null instead of throwing on bad input. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

// ── Game actions ───────────────────────────────────────────────────────────────
const zone = z.enum(["hand", "library", "battlefield", "graveyard", "exile", "commandZone"])
const id = z.string().min(1).max(200)
const seat = z.number().int().min(0).max(15)
const norm = z.number().min(0).max(1)            // normalized board position
const counterDelta = z.number().int().min(-1000).max(1000)
const ids = z.array(id).max(500)

// Validates the shape/bounds of every action before it reaches the reducer, so a
// malformed action can never crash the server or corrupt the game document.
export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("DRAW"), count: z.number().int().min(1).max(100).optional() }),
  z.object({ type: z.literal("TAP"), instanceId: id }),
  z.object({ type: z.literal("UNTAP_ALL") }),
  z.object({ type: z.literal("MOVE"), instanceId: id, fromZone: zone, toZone: zone, x: norm.optional(), y: norm.optional() }),
  z.object({ type: z.literal("MOVE_TO_TOP"), instanceId: id, fromZone: zone }),
  z.object({ type: z.literal("ADJUST_LIFE"), delta: z.number().int().min(-1000).max(1000) }),
  z.object({ type: z.literal("RECORD_CMD_DAMAGE"), fromSeat: seat, amount: z.number().int().min(-100).max(100) }),
  z.object({ type: z.literal("NEXT_PHASE") }),
  z.object({ type: z.literal("ADD_COUNTER"), instanceId: id, counterName: z.string().min(1).max(60), delta: counterDelta }),
  z.object({ type: z.literal("CAST_COMMANDER"), instanceId: id, x: norm.optional(), y: norm.optional() }),
  z.object({ type: z.literal("ADJUST_CMD_TAX"), name: z.string().min(1).max(120), delta: z.number().int().min(-100).max(100) }),
  z.object({ type: z.literal("SHUFFLE") }),
  z.object({ type: z.literal("MILL"), count: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal("SCRY_BOTTOM"), instanceId: id }),
  z.object({ type: z.literal("SCRY_RESOLVE"), top: ids, bottom: ids, graveyard: ids }),
  z.object({ type: z.literal("SET_POSITION"), instanceId: id, x: norm, y: norm }),
  z.object({ type: z.literal("SET_MONARCH"), seat: seat.nullable() }),
  z.object({ type: z.literal("SET_INITIATIVE"), seat: seat.nullable() }),
  z.object({ type: z.literal("SET_FREE_MULLIGAN"), value: z.boolean() }),
  z.object({ type: z.literal("CHAT"), text: z.string().min(1).max(500) }),
  z.object({ type: z.literal("CREATE_TOKEN"), instanceId: id, name: z.string().min(1).max(120), typeLine: z.string().max(120), colorIdentity: z.array(z.string().max(2)).max(5) }),
  z.object({ type: z.literal("FLIP"), instanceId: id }),
  z.object({ type: z.literal("COPY"), instanceId: id, newInstanceId: id }),
  z.object({ type: z.literal("PROLIFERATE") }),
  z.object({ type: z.literal("ADJUST_PLAYER_COUNTER"), counterName: z.string().min(1).max(60), delta: counterDelta }),
  z.object({ type: z.literal("START_GAME") }),
  z.object({ type: z.literal("MULLIGAN") }),
  z.object({ type: z.literal("KEEP_HAND"), bottom: z.array(id).max(20) }),
  z.object({ type: z.literal("FORCE_START") }),
])

// ── Decks ───────────────────────────────────────────────────────────────────────
// Lenient on individual card fields (Mongoose strips unknowns on save); the point
// is to bound the array size and reject non-object garbage.
const deckCard = z.object({
  scryfallId: z.string().max(100),
  name: z.string().max(200),
  quantity: z.number().int().min(1).max(99),
}).loose()

export const deckCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  cards: z.array(deckCard).max(1000).optional(),
})

export const deckUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  cards: z.array(deckCard).max(1000).optional(),
})

// ── Auth ────────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().max(200).refine(
    v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: "Invalid email" }),
  password: z.string().min(8).max(200),
})

// ── Card service payloads (Scryfall/EDHREC proxies) ─────────────────────────────
export const cardNamesSchema = z.object({ names: z.array(z.string().min(1).max(200)).max(2000) })
export const cardIdsSchema = z.object({ ids: z.array(z.string().min(1).max(100)).max(2000) })
