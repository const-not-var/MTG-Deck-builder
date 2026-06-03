import { test, expect } from "@playwright/test"
import { register, login, uniqueUser } from "./helpers"

// Runs under the "mobile" project (Pixel 7 viewport).

test("auth works on a mobile viewport", async ({ page }) => {
  const u = uniqueUser()
  await register(page, u)
  await login(page, u)
  await expect(page).toHaveURL(/\/decks/)
})

test("deck import is reachable and usable on a phone", async ({ page }) => {
  const u = uniqueUser()
  await register(page, u)
  await login(page, u)
  const { deck } = await (await page.request.post("/api/decks", { data: { name: "Mobile Import" } })).json()
  await page.goto(`/decks/${deck._id}`)

  // The import entry is now visible on mobile (was `hidden md:flex`).
  await page.getByLabel("Import decklist").click()
  await page.getByPlaceholder(/Sol Ring/).fill("1 Sol Ring")
  await expect(page.getByText(/1 cards? detected/i)).toBeVisible()
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/cards/import") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Import Cards" }).click(),
  ])
  expect(resp.status()).toBe(200)
})

test("the game is gated to desktop on a phone", async ({ page }) => {
  const u = uniqueUser()
  await register(page, u)
  await login(page, u)
  const { game } = await (await page.request.post("/api/game")).json()
  await page.goto(`/game/${game.code}`, { waitUntil: "domcontentloaded" })
  await expect(page.getByText(/desktop required/i)).toBeVisible({ timeout: 20_000 })
})
