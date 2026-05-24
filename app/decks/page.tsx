import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DecksClient } from "./DecksClient"

export default async function DecksPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return <DecksClient userName={session.user.name} />
}
