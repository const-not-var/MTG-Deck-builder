"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Layers, LogOut, Plus, User } from "lucide-react"

interface NavbarProps {
  userName?: string | null
}

export function Navbar({ userName }: NavbarProps) {
  const path = usePathname()

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "rgba(7,7,30,0.82)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 0 0 rgba(245,158,11,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/decks" className="flex items-center gap-2.5 font-bold text-lg tracking-tight group flex-shrink-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.08) 100%)",
              border: "1px solid rgba(245,158,11,0.30)",
              boxShadow: "0 0 12px rgba(245,158,11,0.12)",
            }}
          >
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <span
            className="transition-colors duration-200"
            style={{
              background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Commander Vault
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/decks"
            className={`hidden sm:block px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              path === "/decks"
                ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
            }`}
          >
            My Decks
          </Link>
          <Link
            href="/decks/new"
            className="flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/25 hover:-translate-y-px transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Deck</span>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {userName && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/40">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <User className="w-3 h-3 text-amber-400" />
              </div>
              <span className="text-xs font-medium text-zinc-300">{userName}</span>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
