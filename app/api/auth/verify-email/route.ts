import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/models/User"

// Confirms an email from the link in the welcome message, then sends the user to login.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const base = process.env.NEXTAUTH_URL ?? origin
  const token = searchParams.get("token")
  if (!token) return NextResponse.redirect(`${base}/login?verify=invalid`)

  await connectDB()
  const user = await User.findOne({ verifyToken: token })
  if (!user) return NextResponse.redirect(`${base}/login?verify=invalid`)

  user.verified = true
  user.verifyToken = undefined
  await user.save()

  return NextResponse.redirect(`${base}/login?verify=success`)
}
