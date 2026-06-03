import { test, expect } from "@playwright/test"
import { register, login, uniqueUser } from "./helpers"

test("register then log in reaches the decks page", async ({ page }) => {
  const u = uniqueUser()
  await register(page, u)
  await expect(page).toHaveURL(/\/login/)
  await login(page, u)
  await expect(page).toHaveURL(/\/decks/)
})

test("login is case-insensitive on email (regression: mixed-case logins)", async ({ page }) => {
  const u = uniqueUser()
  await register(page, u)
  // Log in with an upper-cased email — must still work.
  await page.goto("/login")
  await page.locator('input[type="email"]').fill(u.email.toUpperCase())
  await page.locator('input[type="password"]').fill(u.password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/decks/)
})

test("wrong password is rejected", async ({ page }) => {
  const u = uniqueUser()
  await register(page, u)
  await page.goto("/login")
  await page.locator('input[type="email"]').fill(u.email)
  await page.locator('input[type="password"]').fill("totally-wrong-password")
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText(/invalid email or password/i)).toBeVisible()
})
