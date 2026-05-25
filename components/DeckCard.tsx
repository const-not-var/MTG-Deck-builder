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
    <Link href={`/decks/${deck._id}`} className="group block">
      <div className="overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5">
        {/* Full card image */}
        <div className="bg-zinc-800" style={{ aspectRatio: "5/7" }}>
          {commander?.imageUri ? (
            <img
              src={commander.imageUri}
              alt={commander.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Swords className="w-12 h-12 text-zinc-700" />
            </div>
          )}
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
