import { Page, expect } from "@playwright/test"

export interface TestUser { name: string; email: string; password: string }

export function uniqueUser(): TestUser {
  const n = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  return { name: `E2E ${n}`, email: `e2e_${n}@test.local`, password: "password1234" }
}

export async function register(page: Page, u: TestUser) {
  await page.goto("/register")
  await page.getByPlaceholder("Jace Beleren").fill(u.name)
  await page.locator('input[type="email"]').fill(u.email)
  await page.locator('input[type="password"]').fill(u.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/login/)
}

export async function login(page: Page, u: TestUser) {
  await page.goto("/login")
  await page.locator('input[type="email"]').fill(u.email)
  await page.locator('input[type="password"]').fill(u.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/decks/)
}

export async function registerAndLogin(page: Page): Promise<TestUser> {
  const u = uniqueUser()
  await register(page, u)
  await login(page, u)
  return u
}

// Seeds a minimal but valid Commander deck via the API (must be logged in first):
// one commander + 20 imageless "Island <tag>" cards so the opening hand and board
// render as labelled tokens we can assert on. Returns the deck id.
export async function seedDeck(page: Page, tag: string): Promise<string> {
  const cards = [
    { scryfallId: `cmd-${tag}`, name: `Cmdr ${tag}`, quantity: 1, isCommander: true,
      typeLine: "Legendary Creature — Test", cmc: 4, colorIdentity: ["U"], manaCost: "{2}{U}{U}", imageUri: "", oracleText: "" },
    { scryfallId: `land-${tag}`, name: `Island ${tag}`, quantity: 20, isCommander: false,
      typeLine: "Basic Land — Island", cmc: 0, colorIdentity: [], manaCost: "", imageUri: "", oracleText: "" },
  ]
  const res = await page.request.post("/api/decks", { data: { name: `Deck ${tag}`, cards } })
  if (!res.ok()) throw new Error(`seedDeck failed: ${res.status()}`)
  const { deck } = await res.json()
  return deck._id as string
}
