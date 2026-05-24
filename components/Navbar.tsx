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
    <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/decks" className="flex items-center gap-2 font-bold text-amber-400 text-lg tracking-tight hover:text-amber-300 transition-colors">
          <Layers className="w-5 h-5" />
          Commander Vault
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/decks"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              path === "/decks" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            }`}
          >
            My Decks
          </Link>
          <Link
            href="/decks/new"
            className="flex items-center gap-1 ml-1 px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Deck
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-400">
            <User className="w-3.5 h-3.5" />
            {userName}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
