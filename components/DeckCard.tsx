"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Crown, Swords, ExternalLink, Copy, Trash2, Share2 } from "lucide-react"
import { toast } from "sonner"
import type { Deck } from "@/types"

interface DeckCardProps {
  deck: Deck
  onDuplicate?: () => void
  onDelete?: () => void
}


const COLOR_HEX: Record<string, string> = {
  W: "#f9fafb", U: "#60a5fa", B: "#c084fc", R: "#f87171", G: "#4ade80",
}
const COLOR_SHADOW: Record<string, string> = {
  W: "rgba(249,250,251,0.35)", U: "rgba(96,165,250,0.45)", B: "rgba(192,132,252,0.45)",
  R: "rgba(248,113,113,0.45)", G: "rgba(74,222,128,0.45)",
}

export function DeckCard({ deck, onDuplicate, onDelete }: DeckCardProps) {
  const router = useRouter()
  const commander = deck.cards.find((c) => c.isCommander)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!contextMenu) return
    const onMouse = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null) }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouse)
      document.removeEventListener("keydown", onKey)
    }
  }, [contextMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDeleteConfirm = () => {
    setContextMenu(null)
    toast(`Delete "${deck.name}"?`, {
      description: "This cannot be undone.",
      action: { label: "Delete", onClick: () => onDelete?.() },
    })
  }

  return (
    <div className="relative" onContextMenu={handleContextMenu}>
      <Link
        href={`/decks/${deck._id}`}
        className="group relative block z-0 hover:z-10 outline-none cursor-pointer"
        aria-label={`Open ${deck.name}`}
      >
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
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.08]"
              style={{ transform: "scale(1.02)" }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #111128 0%, #0d0e22 100%)" }}>
              <Swords className="w-12 h-12 text-zinc-700" />
            </div>
          )}

          {/* Gradient overlay — heavier bottom for text legibility */}
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

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[200] py-1 rounded-xl shadow-2xl animate-scale-in"
          style={{
            left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 200),
            top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 600) - 180),
            background: "rgba(14,14,26,0.97)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(20px)",
            minWidth: "180px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          }}
        >
          <button
            role="menuitem"
            onClick={() => { setContextMenu(null); router.push(`/decks/${deck._id}`) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.07] transition-colors text-left"
          >
            Open
          </button>
          <button
            role="menuitem"
            onClick={() => { setContextMenu(null); window.open(`/decks/${deck._id}`, "_blank") }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.07] transition-colors text-left"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500" aria-hidden />
            Open in new tab
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setContextMenu(null)
              const url = `${window.location.origin}/d/${deck._id}`
              navigator.clipboard.writeText(url).then(() => toast.success("Share link copied"))
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.07] transition-colors text-left"
          >
            <Share2 className="w-3.5 h-3.5 text-zinc-500" aria-hidden />
            Copy share link
          </button>

          {onDuplicate && (
            <>
              <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.06)" }} />
              <button
                role="menuitem"
                onClick={() => { setContextMenu(null); onDuplicate() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.07] transition-colors text-left"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-500" aria-hidden />
                Duplicate
              </button>
            </>
          )}

          {onDelete && (
            <>
              <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.06)" }} />
              <button
                role="menuitem"
                onClick={handleDeleteConfirm}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
