import { notFound } from "next/navigation"
import Link from "next/link"
import { connectDB } from "@/lib/db"
import Deck from "@/models/Deck"
import { Crown } from "lucide-react"
import type { Deck as DeckType, CardInDeck } from "@/types"

const COLOR_HEX: Record<string, string> = {
  W: "#f9fafb", U: "#60a5fa", B: "#c084fc", R: "#f87171", G: "#4ade80",
}
const COLOR_SHADOW: Record<string, string> = {
  W: "rgba(249,250,251,0.3)", U: "rgba(96,165,250,0.4)", B: "rgba(192,132,252,0.4)",
  R: "rgba(248,113,113,0.4)", G: "rgba(74,222,128,0.4)",
}

function groupCards(cards: CardInDeck[]): { label: string; cards: CardInDeck[] }[] {
  const groups: Record<string, CardInDeck[]> = {
    Commanders: [],
    Creatures: [],
    Instants: [],
    Sorceries: [],
    Artifacts: [],
    Enchantments: [],
    Planeswalkers: [],
    Lands: [],
    Other: [],
  }
  for (const c of cards) {
    if (c.isCommander || c.isCompanion) { groups.Commanders.push(c); continue }
    const t = c.typeLine ?? ""
    if (/land/i.test(t)) groups.Lands.push(c)
    else if (/creature/i.test(t)) groups.Creatures.push(c)
    else if (/instant/i.test(t)) groups.Instants.push(c)
    else if (/sorcery/i.test(t)) groups.Sorceries.push(c)
    else if (/artifact/i.test(t)) groups.Artifacts.push(c)
    else if (/enchantment/i.test(t)) groups.Enchantments.push(c)
    else if (/planeswalker/i.test(t)) groups.Planeswalkers.push(c)
    else groups.Other.push(c)
  }
  return Object.entries(groups)
    .filter(([, cards]) => cards.length > 0)
    .map(([label, cards]) => ({ label, cards: cards.sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name)) }))
}

export default async function PublicDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await connectDB()
  const raw = await Deck.findById(id).lean()
  if (!raw) notFound()

  const deck = JSON.parse(JSON.stringify(raw)) as DeckType

  const commander = deck.cards.find(c => c.isCommander)
  const artUri = commander?.imageUri?.replace("/normal/", "/art_crop/") ?? null
  const colors = commander?.colorIdentity ?? []

  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0)
  const totalPrice = deck.cards.reduce((s, c) => {
    const raw = c.isFoil ? c.prices?.usdFoil : c.prices?.usd
    const p = parseFloat(raw ?? c.prices?.usdFoil ?? c.prices?.usd ?? "0")
    return s + (isNaN(p) ? 0 : p * c.quantity)
  }, 0)

  const groups = groupCards(deck.cards)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06071c", color: "#fff" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "#f59e0b", boxShadow: "0 4px 12px rgba(245,158,11,0.4)" }}>
            <Crown className="w-3.5 h-3.5 text-zinc-950" />
          </div>
          <span className="font-bold text-sm tracking-tight">Commander Vault</span>
        </Link>
        <Link
          href="/login"
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          Sign In
        </Link>
      </nav>

      {/* ── Hero band ──────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 overflow-hidden" style={{ minHeight: 220 }}>
        {/* Art background */}
        {artUri && (
          <img src={artUri} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-top scale-105"
            style={{ filter: "brightness(0.35) saturate(1.2)" }}
          />
        )}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(6,7,28,0.3) 0%, rgba(6,7,28,0.85) 60%, #06071c 100%)" }} />

        <div className="relative z-10 px-5 sm:px-8 pt-10 pb-8 max-w-4xl mx-auto">
          <div className="flex items-end gap-5">
            {/* Mini commander portrait */}
            {commander?.imageUri && (
              <img
                src={commander.imageUri}
                alt={commander.name}
                className="hidden sm:block rounded-xl shadow-2xl flex-shrink-0"
                style={{ width: 90, aspectRatio: "63/88", objectFit: "cover", objectPosition: "top", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">{deck.name}</h1>
              {commander && (
                <p className="text-sm mt-1" style={{ color: "#fbbf24cc" }}>{commander.name}</p>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {/* Color identity */}
                {colors.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {colors.map(c => (
                      <div key={c} className="w-4 h-4 rounded-full"
                        style={{ background: COLOR_HEX[c] ?? "#6b7280", boxShadow: `0 0 8px ${COLOR_SHADOW[c] ?? "rgba(107,114,128,0.35)"}`, border: "1px solid rgba(0,0,0,0.35)" }} />
                    ))}
                  </div>
                )}
                <span className="text-xs text-zinc-500">{totalCards} cards</span>
                <span className="text-xs font-semibold text-green-400">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {deck.description && (
            <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-xl">{deck.description}</p>
          )}
        </div>
      </div>

      {/* ── Card list ──────────────────────────────────────────────────────── */}
      <main className="flex-1 px-5 sm:px-8 py-8 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          {groups.map(({ label, cards }) => {
            const groupCount = cards.reduce((s, c) => s + c.quantity, 0)
            return (
              <div key={label}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</span>
                  <span className="text-xs text-zinc-700">{groupCount}</span>
                </div>
                <div className="space-y-0.5">
                  {cards.map(card => (
                    <div key={card.scryfallId} className="flex items-center gap-2 group">
                      {card.quantity > 1 && (
                        <span className="text-xs font-bold tabular-nums w-4 text-right flex-shrink-0"
                          style={{ color: "#f59e0b" }}>{card.quantity}×</span>
                      )}
                      {card.quantity === 1 && <span className="w-4 flex-shrink-0" />}
                      <span className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">{card.name}</span>
                      <span className="ml-auto text-[10px] text-zinc-600 tabular-nums flex-shrink-0">
                        {card.cmc > 0 ? card.cmc : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* ── Footer CTA ─────────────────────────────────────────────────────── */}
      <footer className="px-5 sm:px-8 py-10 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-sm text-zinc-500 mb-4">Build your own Commander deck for free.</p>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
          style={{ background: "#f59e0b", color: "#09090b", boxShadow: "0 6px 24px rgba(245,158,11,0.3)" }}
        >
          Get Started Free
        </Link>
      </footer>
    </div>
  )
}
