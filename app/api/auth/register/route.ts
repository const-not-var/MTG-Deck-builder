import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { Resend } from "resend"
import { connectDB } from "@/lib/db"
import User from "@/models/User"
import { rateLimit, getIP } from "@/lib/rateLimit"
import { readJson, registerSchema } from "@/lib/api"

const esc = (s: string) => s.replace(/[<>&"']/g, c =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] as string))

async function sendWelcomeEmail(name: string, email: string, verifyToken: string) {
  if (process.env.E2E_TEST === "1") return   // don't send during automated tests
  if (!process.env.RESEND_API_KEY) return
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Commander Vault <onboarding@resend.dev>",
    to: email,
    subject: "Welcome to Commander Vault — confirm your email",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#07071e;color:#e4e4e7;border-radius:16px;">
        <h2 style="color:#f59e0b;margin:0 0 8px">Welcome to Commander Vault, ${esc(name)}!</h2>
        <p style="color:#a1a1aa;margin:0 0 20px;font-size:14px">Your MTG Commander deck workshop.</p>
        <p style="margin:0 0 16px;font-size:15px">Here's what you can do:</p>
        <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#d4d4d8;line-height:1.7">
          <li><strong>Build &amp; manage Commander decks</strong> with Scryfall search and live TCGPlayer prices.</li>
          <li><strong>Import decklists</strong> from Moxfield, EDHREC, or any standard format.</li>
          <li><strong>Playtest</strong> a deck solo on a free-form battlefield.</li>
          <li><strong>Play with friends online</strong> — share a game code and battle on a shared table.</li>
        </ul>
        <p style="margin:0 0 16px;font-size:15px">First, please confirm your email address:</p>
        <a href="${verifyUrl}"
          style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#09090b;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">
          Confirm my email
        </a>
        <p style="margin:20px 0 0;font-size:12px;color:#71717a;">Or paste this link into your browser:<br>${verifyUrl}</p>
      </div>
    `,
  })
}

export async function POST(req: Request) {
  try {
    const { allowed, retryAfter } = rateLimit(`register:${getIP(req)}`, 5, 15 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } })

    const parsed = registerSchema.safeParse(await readJson(req))
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input"
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { name, email, password } = parsed.data   // email already trimmed + lowercased

    await connectDB()

    const existing = await User.findOne({ email })
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)

    // Only require email confirmation when we can actually send the email. In tests
    // (E2E_TEST) or when Resend isn't configured, accounts are created pre-verified
    // so no one gets locked out with no way to confirm.
    const emailEnabled = !!process.env.RESEND_API_KEY && process.env.E2E_TEST !== "1"
    const verifyToken = emailEnabled ? crypto.randomBytes(32).toString("hex") : undefined
    await User.create({ name, email, password: hashed, verified: !emailEnabled, verifyToken })

    if (emailEnabled && verifyToken) {
      // Best-effort — never block/fail registration on the email.
      try { await sendWelcomeEmail(name, email, verifyToken) } catch (e) { console.error("[register] welcome email failed:", e) }
    }

    return NextResponse.json({ message: "Account created successfully" }, { status: 201 })
  } catch (err) {
    console.error("[register] error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
