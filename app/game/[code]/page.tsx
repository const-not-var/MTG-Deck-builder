import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { GameClient } from "./GameClient"

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { code } = await params
  return (
    <Suspense>
      {/* The game table is desktop-only (mouse drag, multi-board layout). On small
          screens, show a gate instead of an unplayable board. Pure CSS so it's
          SSR-safe and covers every game state (lobby / mulligan / active). */}
      <div
        className="md:hidden fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ background: "#06071c" }}
      >
        <span className="text-5xl">🖥️</span>
        <h1 className="text-xl font-bold text-zinc-100">Desktop required</h1>
        <p className="text-sm text-zinc-400 max-w-xs">
          The game table needs a larger screen and a mouse. Open this game on a desktop or laptop to play.
        </p>
        <a href="/decks" className="mt-2 text-sm font-semibold text-amber-400 hover:text-amber-300">
          ← Back to decks
        </a>
      </div>

      <GameClient
        code={code.toUpperCase()}
        userId={session.user.id}
        userName={session.user.name ?? "Player"}
      />
    </Suspense>
  )
}
