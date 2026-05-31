"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Crown, Swords } from "lucide-react"
import type { Deck } from "@/types"

interface DeckCardProps {
  deck: Deck
}

const COLOR_HEX: Record<string, string> = {
  W: "#f9fafb",
  U: "#60a5fa",
  B: "#c084fc",
  R: "#f87171",
  G: "#4ade80",
}

const COLOR_SHADOW: Record<string, string> = {
  W: "rgba(249,250,251,0.35)",
  U: "rgba(96,165,250,0.45)",
  B: "rgba(192,132,252,0.45)",
  R: "rgba(248,113,113,0.45)",
  G: "rgba(74,222,128,0.45)",
}

export function DeckCard({ deck }: DeckCardProps) {
  const commander = deck.cards.find((c) => c.isCommander)

  const { totalPrice, totalCards } = useMemo(() => {
    let price = 0
    let count = 0
    for (const c of deck.cards) {
      const raw = c.isFoil ? c.prices?.usdFoil : c.prices?.usd
      const p = parseFloat(raw ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
      price += isNaN(p) ? 0 : p * c.quantity
      count += c.quantity
    }
    return { totalPrice: price, totalCards: count }
  }, [deck.cards])

  const artUri = commander?.imageUri?.replace("/normal/", "/art_crop/") ?? null
  const colors = commander?.colorIdentity ?? []

  return (
    <Link href={`/decks/${deck._id}`} className="group relative block z-0 hover:z-10 outline-none">
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-500 shadow-lg group-hover:shadow-2xl group-hover:-translate-y-2"
        style={{
          aspectRatio: "3/4",
          background: "#0b0c1e",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* Full-bleed art */}
        {artUri ? (
          <img
            src={artUri}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-108"
            style={{ transform: "scale(1.02)" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #111128 0%, #0d0e22 100%)" }}>
            <Swords className="w-12 h-12 text-zinc-700" />
          </div>
        )}

        {/* Gradient overlays — heavier bottom gradient for text legibility */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(6,7,28,0.98) 0%, rgba(6,7,28,0.5) 35%, rgba(6,7,28,0.15) 65%, rgba(6,7,28,0.45) 100%)" }} />

        {/* Hover glow border */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.25)" }} />

        {/* Color identity pips — top right */}
        {colors.length > 0 && (
          <div className="absolute top-2.5 right-2.5 flex gap-1">
            {colors.map((c) => (
              <div
                key={c}
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: COLOR_HEX[c] ?? "#6b7280",
                  boxShadow: `0 0 6px ${COLOR_SHADOW[c] ?? "rgba(107,114,128,0.4)"}`,
                  border: "1px solid rgba(0,0,0,0.4)",
                }}
              />
            ))}
          </div>
        )}

        {/* Commander crown badge — top left */}
        {commander && (
          <div className="absolute top-2.5 left-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "#f59e0b", boxShadow: "0 2px 8px rgba(245,158,11,0.5)" }}>
              <Crown className="w-2.5 h-2.5 text-zinc-950" />
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 px-3 pb-3.5 pt-8">
          <h3 className="font-bold text-white text-[14px] leading-snug truncate">
            {deck.name}
          </h3>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: commander ? "#fbbf24cc" : "#52525b" }}>
            {commander?.name ?? "No commander set"}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] tabular-nums" style={{ color: "rgba(161,161,170,0.6)" }}>
              {totalCards} cards
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-green-400">
              ${totalPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
