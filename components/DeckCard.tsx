"use client"

import Link from "next/link"
import { Crown, Swords, DollarSign, Calendar } from "lucide-react"
import type { Deck } from "@/types"
import { ColorPip } from "./ManaSymbol"

interface DeckCardProps {
  deck: Deck
}

export function DeckCard({ deck }: DeckCardProps) {
  const commander = deck.cards.find((c) => c.isCommander)
  const cardCount = deck.cards.reduce((s, c) => s + c.quantity, 0)
  const totalPrice = deck.cards.reduce((s, c) => {
    const p = parseFloat(c.prices?.usd ?? c.prices?.usdFoil ?? "0")
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0)

  const colorIdentity = commander?.colorIdentity ?? []
  const updatedAt = new Date(deck.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  return (
    <Link href={`/decks/${deck._id}`} className="group block">
      <div className="relative overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5">
        {/* Commander art */}
        <div className="relative h-44 bg-zinc-800 overflow-hidden">
          {commander?.imageUri ? (
            <>
              <img
                src={commander.imageUri}
                alt={commander.name}
                className="absolute inset-0 w-full object-cover object-top scale-105 group-hover:scale-110 transition-transform duration-500"
                style={{ height: "200%" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/30 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Swords className="w-12 h-12 text-zinc-700" />
            </div>
          )}

          {/* Color identity pips */}
          {colorIdentity.length > 0 && (
            <div className="absolute top-2 right-2 flex gap-1">
              {colorIdentity.map((c) => (
                <ColorPip key={c} color={c} />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-zinc-100 text-base truncate mb-1">{deck.name}</h3>
          {commander && (
            <p className="text-xs text-amber-400/80 flex items-center gap-1 mb-3 truncate">
              <Crown className="w-3 h-3 flex-shrink-0" />
              {commander.name}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Swords className="w-3 h-3" />
              {cardCount}/100
            </span>
            <span className="flex items-center gap-1 text-green-400/80">
              <DollarSign className="w-3 h-3" />
              {totalPrice.toFixed(2)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {updatedAt}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
