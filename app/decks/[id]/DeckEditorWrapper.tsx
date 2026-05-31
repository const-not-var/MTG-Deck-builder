"use client"

import { Navbar } from "@/components/Navbar"
import { DeckEditor } from "@/components/DeckEditor"

interface Props {
  deckId: string
  userName?: string | null
}

export function DeckEditorWrapper({ deckId, userName }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06071e" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% -10%, rgba(109,40,217,0.22) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 110%, rgba(245,158,11,0.14) 0%, transparent 55%),
            radial-gradient(ellipse 50% 50% at 50% 50%, rgba(6,182,212,0.07) 0%, transparent 70%)
          `,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative flex flex-col h-screen overflow-hidden">
        <Navbar userName={userName} />
        <div className="h-14 flex-shrink-0" />
        <DeckEditor deckId={deckId} />
      </div>
    </div>
  )
}
