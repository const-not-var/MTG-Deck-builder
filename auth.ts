import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import User from "@/models/User"
import { authConfig } from "./auth.config"
import { rateLimit } from "@/lib/rateLimit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        // Rate limit by email to stop credential stuffing against a specific account
        const key = `login:${String(credentials.email).toLowerCase()}`
        const { allowed } = rateLimit(key, 5, 15 * 60 * 1000)
        if (!allowed) throw new Error("Too many login attempts. Try again in 15 minutes.")

        await connectDB()
        // Registration stores emails lowercased — match that here or mixed-case logins fail.
        const user = await User.findOne({ email: String(credentials.email).toLowerCase() })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null

        // Block login while an email confirmation is still pending (a verifyToken
        // exists only for accounts created with the email-confirmation flow).
        if (!user.verified && user.verifyToken) return null

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 60,    // log out after 30 min of inactivity…
    updateAge: 5 * 60,  // …sliding: refresh the token (at most every 5 min) while the user is active
  },
})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
    }
  }
}
