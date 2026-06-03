import { test, expect, Page } from "@playwright/test"
import { registerAndLogin } from "./helpers"

// Messages that aren't JS bugs (network 404s for images/favicon, dev hints).
const IGNORE = [
  /Failed to load resource/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", e => errors.push(`pageerror: ${e.message}`))
  page.on("console", m => {
    if (m.type() !== "error") return
    const t = m.text()
    if (!IGNORE.some(re => re.test(t))) errors.push(t)
  })
  return errors
}

test("core pages render without console errors or uncaught exceptions", async ({ page }) => {
  const errors = collectErrors(page)

  // /register and /login are visited inside the helper.
  await registerAndLogin(page)
  await page.waitForTimeout(800)

  // Deck editor (search | list | stats — includes the mana-curve chart).
  const { deck } = await (await page.request.post("/api/decks", { data: { name: "Console Check" } })).json()
  await page.goto(`/decks/${deck._id}`)
  await page.waitForTimeout(1500)

  // Game lobby.
  const { game } = await (await page.request.post("/api/game")).json()
  await page.goto(`/game/${game.code}`)
  await page.waitForTimeout(1500)

  expect(errors, `Console errors found:\n${errors.join("\n")}`).toEqual([])
})
