import { test, expect } from "@playwright/test"
import { registerAndLogin, seedDeck } from "./helpers"

// Reproduction guard: every card in the chosen deck must be present at game start
// (1 commander + 20 lands = 21 total). Catches card-loss between deck and game.
test("no cards are lost between the deck and game start", async ({ page }) => {
  await registerAndLogin(page)
  const deckId = await seedDeck(page, "CNT")  // commander x1 + Island x20 = 21
  const { game } = await (await page.request.post("/api/game")).json()
  expect((await page.request.post(`/api/game/${game.code}/join`, { data: { deckId } })).ok()).toBeTruthy()

  const state = await (await page.request.get(`/api/game/${game.code}`)).json()
  const me = state.game.players[0]
  const total = me.commandZone.length + me.hand.length + me.library.length
  expect(total).toBe(21)
  expect(me.commandZone.length).toBe(1)  // the commander
})
