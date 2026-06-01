import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import User from "@/models/User"
import { rateLimit, getIP } from "@/lib/rateLimit"

export async function POST(req: Request) {
  try {
    const { allowed, retryAfter } = rateLimit(`reset:${getIP(req)}`, 5, 15 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } })

    const { token, password } = await req.json()
    if (!token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })

    await connectDB()
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    })

    if (!user) return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })

    user.password = await bcrypt.hash(password, 12)
    user.resetToken = undefined
    user.resetTokenExpiry = undefined
    await user.save()

    return NextResponse.json({ message: "Password updated successfully" })
  } catch (err) {
    console.error("[reset-password]", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
