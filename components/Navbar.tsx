"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { Layers, LogOut, User, Swords } from "lucide-react"

interface NavbarProps {
  userName?: string | null
}

export function Navbar({ userName }: NavbarProps) {

  return (
    <header
      className="fixed top-0 inset-x-0 z-[60]"
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

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/game"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all"
          >
            <Swords className="w-3.5 h-3.5" />
            Play
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
            aria-label="Sign out"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline" aria-hidden>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
