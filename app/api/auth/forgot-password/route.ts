import { NextResponse } from "next/server"
import crypto from "crypto"
import { Resend } from "resend"
import { connectDB } from "@/lib/db"
import User from "@/models/User"
import { rateLimit, getIP } from "@/lib/rateLimit"

export async function POST(req: Request) {
  try {
    const { allowed, retryAfter } = rateLimit(`forgot:${getIP(req)}`, 3, 15 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } })

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    await connectDB()
    const user = await User.findOne({ email: email.toLowerCase() })

    // Always return success to avoid leaking whether an account exists
    if (!user) return NextResponse.json({ message: "If that email exists, a reset link has been sent." })

    const token = crypto.randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

    user.resetToken = token
    user.resetTokenExpiry = expiry
    await user.save()

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Commander Vault <onboarding@resend.dev>",
      to: user.email,
      subject: "Reset your Commander Vault password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#07071e;color:#e4e4e7;border-radius:16px;">
          <h2 style="color:#f59e0b;margin:0 0 8px">Commander Vault</h2>
          <p style="color:#a1a1aa;margin:0 0 24px;font-size:14px">Password reset request</p>
          <p style="margin:0 0 24px;font-size:15px">Hi ${user.name},</p>
          <p style="margin:0 0 24px;font-size:15px">Someone requested a password reset for your account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#09090b;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">
            Reset Password
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#71717a;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        </div>
      `,
    })

    return NextResponse.json({ message: "If that email exists, a reset link has been sent." })
  } catch (err) {
    console.error("[forgot-password]", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
