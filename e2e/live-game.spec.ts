import { test, expect } from "@playwright/test"
import { registerAndLogin, seedDeck } from "./helpers"

// Two real sessions in one game: the full multiplayer happy path, plus the two
// things hardest to get right — live cross-player sync and hand redaction.
test("two players: lobby → mulligan → play a card syncs to the opponent (and hands stay hidden)", async ({ browser }) => {
  test.setTimeout(90_000)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const A = await ctxA.newPage()
  const B = await ctxB.newPage()

  await registerAndLogin(A)
  await registerAndLogin(B)
  const deckA = await seedDeck(A, "AA")
  const deckB = await seedDeck(B, "BB")

  // A creates the game; both players join (the host must join to be a player).
  const { game } = await (await A.request.post("/api/game")).json()
  const code: string = game.code
  expect((await A.request.post(`/api/game/${code}/join`, { data: { deckId: deckA } })).ok()).toBeTruthy()
  expect((await B.request.post(`/api/game/${code}/join`, { data: { deckId: deckB } })).ok()).toBeTruthy()

  await A.goto(`/game/${code}`)
  await B.goto(`/game/${code}`)

  // Host starts → both reach the mulligan screen.
  await A.getByRole("button", { name: /start game/i }).click()
  await expect(A.getByRole("button", { name: /keep hand/i })).toBeVisible({ timeout: 10_000 })
  await expect(B.getByRole("button", { name: /keep hand/i })).toBeVisible({ timeout: 10_000 })

  // Both keep. Keep A first and let it persist before B keeps, so the "all kept →
  // start turn 1" gate fires deterministically.
  await A.getByRole("button", { name: /keep hand/i }).click()
  await A.waitForTimeout(1500)
  await B.getByRole("button", { name: /keep hand/i }).click()

  // The active board shows the "Untap All" header action (only present once active).
  await expect(A.getByRole("button", { name: /untap all/i })).toBeVisible({ timeout: 10_000 })
  await expect(B.getByRole("button", { name: /untap all/i })).toBeVisible({ timeout: 10_000 })

  // ── Hand redaction: B's authoritative view of A must hide A's hidden zones ──
  const stateOnB = await (await B.request.get(`/api/game/${code}`)).json()
  const aOnB = stateOnB.game.players.find((p: { seatIndex: number }) => p.seatIndex === 0)
  expect(aOnB.library).toEqual([])                                                   // library hidden
  expect(aOnB.hand.length).toBeGreaterThan(0)                                        // count preserved
  expect(aOnB.hand.every((c: { name: string }) => c.name === "")).toBeTruthy()       // names blanked

  // ── A drags a card from hand onto the battlefield → B sees it on A's board ──
  const handCard = A.getByText("Island AA").first()
  const boxEl = await handCard.boundingBox()
  if (!boxEl) throw new Error("could not locate a hand card")
  const vp = A.viewportSize()!
  await A.mouse.move(boxEl.x + boxEl.width / 2, boxEl.y + boxEl.height / 2)
  await A.mouse.down()
  await A.mouse.move(vp.width / 2, boxEl.y - 170, { steps: 14 })   // drop above the hand, onto the board
  await A.mouse.up()

  // The played card now exists on A's board and, within a poll cycle, on B's
  // opponent board (it's an imageless token, so it renders as labelled text).
  await expect(B.getByText("Island AA").first()).toBeVisible({ timeout: 10_000 })

  await ctxA.close()
  await ctxB.close()
})
