"use client"

import { Navbar } from "@/components/Navbar"
import { DeckEditor } from "@/components/DeckEditor"

interface Props {
  deckId: string
  userName?: string | null
}

export function DeckEditorWrapper({ deckId, userName }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userName={userName} />
      <DeckEditor deckId={deckId} />
    </div>
  )
}
