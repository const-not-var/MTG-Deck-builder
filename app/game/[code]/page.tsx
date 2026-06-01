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
      <GameClient
        code={code.toUpperCase()}
        userId={session.user.id}
        userName={session.user.name ?? "Player"}
      />
    </Suspense>
  )
}
