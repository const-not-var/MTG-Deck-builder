"use client"

import Link from "next/link"
import { Crown, Swords } from "lucide-react"
import type { Deck } from "@/types"

interface DeckCardProps {
  deck: Deck
}

const COLOR_DOTS: Record<string, string> = {
  W: "#f9fafb",
  U: "#60a5fa",
  B: "#c084fc",
  R: "#f87171",
  G: "#4ade80",
}

export function DeckCard({ deck }: DeckCardProps) {
  const commander = deck.cards.find((c) => c.isCommander)
  const totalPrice = deck.cards.reduce((s, c) => {
    const p = parseFloat(
      (c.isFoil ? c.prices?.usdFoil : c.prices?.usd) ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0"
    )
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0)

  // Art crop gives a cleaner full-bleed look than the bordered card image
  const artUri = commander?.imageUri?.replace("/normal/", "/art_crop/") ?? null

  return (
    <Link href={`/decks/${deck._id}`} className="group relative block z-0 hover:z-10">
      <div
        className="relative rounded-2xl overflow-hidden border border-zinc-800/60 transition-all duration-500 shadow-md group-hover:shadow-2xl group-hover:shadow-black/60 group-hover:border-amber-500/35 group-hover:-translate-y-2"
        style={{ aspectRatio: "3/4", background: "#0d0d1a" }}
      >
        {/* Full-bleed art */}
        {artUri ? (
          <img
            src={artUri}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800/80 to-zinc-900">
            <Swords className="w-14 h-14 text-zinc-600" />
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-transparent to-transparent" />

        {/* Hover glow ring */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/0 group-hover:ring-amber-500/20 transition-all duration-500" />

        {/* Color identity pips — top right */}
        {commander?.colorIdentity && commander.colorIdentity.length > 0 && (
          <div className="absolute top-3 right-3 flex gap-1">
            {commander.colorIdentity.map((c) => (
              <div
                key={c}
                className="w-3.5 h-3.5 rounded-full ring-1 ring-black/40 shadow-md"
                style={{ backgroundColor: COLOR_DOTS[c] ?? "#6b7280" }}
              />
            ))}
          </div>
        )}

        {/* Commander crown badge — top left */}
        {commander && (
          <div className="absolute top-3 left-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50">
              <Crown className="w-3 h-3 text-zinc-950" />
            </div>
          </div>
        )}


        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 px-3.5 pb-4 pt-10">
          <h3 className="font-bold text-white text-[15px] leading-snug truncate">
            {deck.name}
          </h3>
          {commander ? (
            <p className="text-[11px] text-amber-300/90 truncate mt-0.5">
              {commander.name}
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500 mt-0.5">No commander set</p>
          )}
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[11px] text-zinc-400/70">
              {deck.cards.length} cards
            </span>
            <span className="text-xs font-semibold text-green-400">
              ${totalPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
