"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Layers, Loader2, AlertCircle } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)
    if (res?.error) {
      setError("Invalid email or password.")
    } else {
      router.push("/decks")
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* MTG background art */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://cards.scryfall.io/art_crop/front/4/a/4a1f905f-1d55-4d02-9d24-e58070793d3f.jpg?1717951088"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(9,9,11,0.85) 0%, rgba(15,15,26,0.75) 100%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <Layers className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Commander Vault</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4" style={{ background: "rgba(9,9,11,0.75)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p className="text-center text-xs text-zinc-500 pt-1">
            No account?{" "}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 transition-colors">
              Create one free
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
