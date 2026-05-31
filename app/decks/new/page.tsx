import { redirect } from "next/navigation"

export default function NewDeckPage() {
  redirect("/decks?new=1")
}
