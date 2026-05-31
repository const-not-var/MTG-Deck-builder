import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DecksClient } from "./DecksClient"

export default async function DecksPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <Suspense>
      <DecksClient userName={session.user.name} />
    </Suspense>
  )
}
