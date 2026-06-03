import { test, expect } from "@playwright/test"
import { registerAndLogin } from "./helpers"

test("create a deck, import a decklist, then delete it", async ({ page }) => {
  await registerAndLogin(page)

  // Create via API using the logged-in session cookie.
  const created = await page.request.post("/api/decks", { data: { name: "E2E Import Deck" } })
  expect(created.ok()).toBeTruthy()
  const { deck } = await created.json()
  expect(deck._id).toBeTruthy()

  // Open the editor and import a small list.
  await page.goto(`/decks/${deck._id}`)
  await page.getByLabel("Import decklist").click()
  await page.getByPlaceholder(/Sol Ring/).fill("1 Sol Ring\n1 Command Tower")
  await expect(page.getByText(/2 cards detected/i)).toBeVisible()

  // Importing resolves cards through the import API (hits Scryfall — allow time).
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/cards/import") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Import Cards" }).click(),
  ])
  expect(resp.status()).toBe(200)
  await expect(page.getByText("Sol Ring").first()).toBeVisible({ timeout: 20_000 })

  // Clean up.
  const del = await page.request.delete(`/api/decks/${deck._id}`)
  expect(del.ok()).toBeTruthy()
})

test("import fuzzy-resolves a misspelled card name", async ({ page }) => {
  await registerAndLogin(page)

  // Deliberately misspelled names that exact-match would silently drop, but
  // fuzzy search should resolve. Guards the silent-card-loss regression.
  const res = await page.request.post("/api/cards/import", {
    data: { names: ["Lightnig Bolt", "Swords to Plowshars"] },
  })
  expect(res.status()).toBe(200)
  const { cards, aliases, notFound } = await res.json()

  // Both should resolve via the fuzzy pass, not land in notFound.
  expect(aliases["lightnig bolt"]).toBe("Lightning Bolt")
  expect(aliases["swords to plowshars"]).toBe("Swords to Plowshares")
  expect(notFound).not.toContain("Lightnig Bolt")
  expect(notFound).not.toContain("Swords to Plowshars")

  const names = cards.map((c: { name: string }) => c.name)
  expect(names).toContain("Lightning Bolt")
  expect(names).toContain("Swords to Plowshares")
})

test("rejects an oversized decklist payload (validation)", async ({ page }) => {
  await registerAndLogin(page)
  const cards = Array.from({ length: 1001 }, (_, i) => ({ scryfallId: `x${i}`, name: `Card ${i}`, quantity: 1 }))
  const res = await page.request.post("/api/decks", { data: { name: "Too Big", cards } })
  expect(res.status()).toBe(400)
})

test("malformed deck id is a clean 404, not a 500", async ({ page }) => {
  await registerAndLogin(page)
  const res = await page.request.get("/api/decks/not-a-valid-object-id")
  expect(res.status()).toBe(404)
})
