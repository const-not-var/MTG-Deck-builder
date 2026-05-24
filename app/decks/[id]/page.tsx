import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DeckEditorWrapper } from "./DeckEditorWrapper"

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params
  return <DeckEditorWrapper deckId={id} userName={session.user.name} />
}
