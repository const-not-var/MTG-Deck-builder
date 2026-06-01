import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { LobbyClient } from "./LobbyClient"

export default async function GameLobbyPage() {
  const session = await auth()
  if (!session) redirect("/login")
  return (
    <Suspense>
      <LobbyClient userId={session.user.id} userName={session.user.name ?? "Player"} />
    </Suspense>
  )
}
