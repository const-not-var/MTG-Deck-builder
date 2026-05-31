import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import User from "@/models/User"
import { rateLimit, getIP } from "@/lib/rateLimit"

export async function POST(req: Request) {
  try {
    const { allowed, retryAfter } = rateLimit(`register:${getIP(req)}`, 5, 15 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } })

    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    await connectDB()

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    await User.create({ name, email: email.toLowerCase(), password: hashed })

    return NextResponse.json({ message: "Account created successfully" }, { status: 201 })
  } catch (err) {
    console.error("[register] error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
