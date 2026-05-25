"use client"

import Link from "next/link"
import { Crown, Swords, DollarSign } from "lucide-react"
import type { Deck } from "@/types"

interface DeckCardProps {
  deck: Deck
}

export function DeckCard({ deck }: DeckCardProps) {
  const commander = deck.cards.find((c) => c.isCommander)
  const totalPrice = deck.cards.reduce((s, c) => {
    const p = parseFloat(c.prices?.usd ?? c.prices?.usdFoil ?? "0")
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0)

  return (
    <Link href={`/decks/${deck._id}`} className="group relative block z-0 hover:z-10">
      <div className="rounded-xl bg-zinc-900 border-2 border-zinc-700 group-hover:border-amber-500/60 transition-colors duration-300">
        {/* Full card image — overflows the container on hover */}
        <div className="relative bg-zinc-900 rounded-t-xl" style={{ aspectRatio: "5/7" }}>
          {commander?.imageUri ? (
            <img
              src={commander.imageUri}
              alt={commander.name}
              className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-3 group-hover:drop-shadow-[0_16px_32px_rgba(0,0,0,0.9)]"
              style={{ borderRadius: "5%" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Swords className="w-12 h-12 text-zinc-700" />
            </div>
          )}
          {/* Gradient fade into info section — hidden when card lifts */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-0" />
        </div>

        {/* Info */}
        <div className="px-3 py-2.5">
          <h3 className="font-semibold text-zinc-100 text-sm truncate">{deck.name}</h3>
          {commander ? (
            <p className="text-xs text-amber-400/80 flex items-center gap-1 mt-0.5 truncate">
              <Crown className="w-3 h-3 flex-shrink-0" />
              {commander.name}
            </p>
          ) : (
            <p className="text-xs text-zinc-600 mt-0.5">No commander set</p>
          )}
          <p className="text-xs text-green-400 flex items-center gap-0.5 mt-1">
            <DollarSign className="w-3 h-3" />
            {totalPrice.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  )
}
