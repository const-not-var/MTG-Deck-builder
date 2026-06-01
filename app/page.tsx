import { redirect } from "next/navigation"
import { auth } from "@/auth"
import Link from "next/link"
import { Layers, Users, Swords, Crown } from "lucide-react"

const COLOR_HEX: Record<string, string> = {
  W: "#f9fafb", U: "#60a5fa", B: "#c084fc", R: "#f87171", G: "#4ade80",
}

const features = [
  {
    icon: Layers,
    title: "Deck Builder",
    body: "Search every Magic card, build 100-card Commander decks, and validate color identity automatically. Real-time price tracking included.",
    color: "#f59e0b",
  },
  {
    icon: Users,
    title: "Multiplayer Table",
    body: "Host or join a 2–4 player game with a shareable room code. Full game state — life totals, phases, commander damage — synced in real time.",
    color: "#60a5fa",
  },
  {
    icon: Swords,
    title: "Solo Playtesting",
    body: "Drag cards onto a virtual playmat, tap permanents, track counters, and step through game phases — no opponent needed.",
    color: "#4ade80",
  },
]

export default async function Home() {
  const session = await auth()
  if (session) redirect("/decks")

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06071c", color: "#fff" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "#f59e0b", boxShadow: "0 4px 16px rgba(245,158,11,0.4)" }}>
            <Crown className="w-4 h-4 text-zinc-950" />
          </div>
          <span className="font-bold text-base tracking-tight">Commander Vault</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          Sign In
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20 flex-1">

        {/* Color identity showcase */}
        <div className="flex items-center gap-2 mb-8">
          {Object.entries(COLOR_HEX).map(([c, hex]) => (
            <div
              key={c}
              className="w-4 h-4 rounded-full"
              style={{
                background: hex,
                boxShadow: `0 0 12px ${hex}66`,
                border: "1px solid rgba(0,0,0,0.3)",
              }}
            />
          ))}
        </div>

        <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-5 leading-none"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
          Build.<br className="sm:hidden" /> Pilot.<br className="sm:hidden" /> Command.
        </h1>

        <p className="text-lg text-zinc-400 max-w-lg mb-10 leading-relaxed">
          The Commander deck builder with a full multiplayer game table — from brewing to casting in one place.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/login"
            className="px-7 py-3 rounded-xl text-base font-bold transition-all active:scale-95"
            style={{
              background: "#f59e0b",
              color: "#09090b",
              boxShadow: "0 8px 32px rgba(245,158,11,0.35)",
            }}
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="px-7 py-3 rounded-xl text-base font-semibold text-zinc-300 transition-colors hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────────── */}
      <section className="px-6 pb-24 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, body, color }) => (
            <div
              key={title}
              className="rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${color}18`, border: `1px solid ${color}33` }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color }} />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <footer className="text-center py-6 text-xs text-zinc-700"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        Commander Vault — fan-made tool, not affiliated with Wizards of the Coast.
      </footer>
    </div>
  )
}
