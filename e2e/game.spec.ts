import { test, expect } from "@playwright/test"
import { registerAndLogin } from "./helpers"

test("create a game and land in the lobby", async ({ page }) => {
  await registerAndLogin(page)
  const res = await page.request.post("/api/game")
  expect(res.ok()).toBeTruthy()
  const { game } = await res.json()
  expect(game.code).toMatch(/^[A-Z0-9]{6}$/)

  await page.goto(`/game/${game.code}`)
  await expect(page.getByText(/Waiting for Players/i)).toBeVisible()
  await expect(page.getByText(game.code)).toBeVisible()
})

test("a malformed game action is a clean 400, not a 500 (DoS guard)", async ({ page }) => {
  await registerAndLogin(page)
  const { game } = await (await page.request.post("/api/game")).json()
  // The classic crash vector: a bad zone that used to make the reducer throw.
  const res = await page.request.patch(`/api/game/${game.code}`, {
    data: { action: { type: "MOVE", instanceId: "x", fromZone: "life", toZone: "battlefield" } },
  })
  expect(res.status()).toBe(400)
})

test("a non-member cannot act on someone else's game (403)", async ({ page, browser }) => {
  // User A creates a game.
  await registerAndLogin(page)
  const { game } = await (await page.request.post("/api/game")).json()

  // User B (separate context) tries to act on it without joining.
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await registerAndLogin(pageB)
  const res = await pageB.request.patch(`/api/game/${game.code}`, {
    data: { action: { type: "DRAW" } },
  })
  expect(res.status()).toBe(403)
  await ctxB.close()
})
