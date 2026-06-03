"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Layers, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { markTabAuthenticated } from "@/lib/tabSession"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)

  // Read the email-confirmation result from the verify-email redirect (no Suspense needed).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("verify")
    if (v === "success") setNotice("Email confirmed — you can now log in.")
    else if (v === "invalid") setError("That confirmation link is invalid or has expired.")
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError("Invalid email or password — or your email isn't confirmed yet. Check your inbox for the confirmation link.")
    else { markTabAuthenticated(); router.push("/decks") }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* Branded background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: [
            "radial-gradient(ellipse 100% 80% at 15% 90%, rgba(109,40,217,0.3) 0%, transparent 60%)",
            "radial-gradient(ellipse 70% 60% at 85% 10%, rgba(245,158,11,0.18) 0%, transparent 55%)",
            "#06071c",
          ].join(", ")
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", boxShadow: "0 0 32px rgba(245,158,11,0.12)" }}>
            <Layers className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight gradient-text">Commander Vault</h1>
          <p className="text-sm text-zinc-500 mt-1.5">Welcome back</p>
        </div>

        <div className="rounded-2xl p-6 space-y-4"
          style={{ background: "rgba(10,10,22,0.85)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)", boxShadow: "0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          {notice && (
            <div className="flex items-center gap-2.5 text-sm text-green-400 bg-green-950/40 border border-green-500/20 rounded-xl px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {notice}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2.5 text-sm text-red-400 bg-red-950/40 border border-red-500/20 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 tracking-wide">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-400 tracking-wide">Password</label>
                <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-amber-400 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 mt-1"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-500 pt-1">
            No account?{" "}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-medium">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
