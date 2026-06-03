import { test, expect } from "@playwright/test"
import mongoose from "mongoose"
import { register, login, uniqueUser } from "./helpers"

const TEST_DB = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/commandervault_e2e"

// Put an account into the "registered but email not yet confirmed" state, the way a
// real RESEND-backed signup would (E2E registrations are created pre-verified).
async function setPendingVerification(email: string, token: string) {
  const conn = await mongoose.createConnection(TEST_DB).asPromise()
  const res = await conn.collection("users").updateOne(
    { email }, { $set: { verified: false, verifyToken: token } })
  await conn.close()
  if (res.matchedCount !== 1) throw new Error(`expected 1 user for ${email}, matched ${res.matchedCount}`)
}

test("email confirmation gates login, and the confirm link unlocks it", async ({ page }) => {
  const u = uniqueUser()
  await register(page, u)

  const token = `e2e-verify-${Date.now()}`
  await setPendingVerification(u.email, token)

  // 1) Login is blocked while confirmation is pending.
  await page.goto("/login")
  await page.locator('input[type="email"]').fill(u.email)
  await page.locator('input[type="password"]').fill(u.password)
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText(/confirmation link/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)

  // 2) Clicking the confirmation link verifies the account and returns to login.
  await page.goto(`/api/auth/verify-email?token=${token}`)
  await expect(page).toHaveURL(/\/login\?verify=success/)
  await expect(page.getByText(/email confirmed/i)).toBeVisible()

  // 3) Login now succeeds.
  await login(page, u)
  await expect(page).toHaveURL(/\/decks/)
})
