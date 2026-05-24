import { redirect } from "next/navigation"

// /decks/new just redirects to /decks — new deck creation is handled by the modal there
export default function NewDeckPage() {
  redirect("/decks")
}
