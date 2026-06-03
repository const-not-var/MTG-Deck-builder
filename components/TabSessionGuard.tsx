"use client"

import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { tabIsAuthenticated } from "@/lib/tabSession"

/**
 * Enforces "log out when the tab is closed". If a tab is authenticated (valid
 * cookie) but was not logged into in *this* tab — i.e. it has no per-tab marker,
 * which means it's a newly opened or reopened tab — we sign it out and send it
 * to the login page. Reloading the same tab keeps the marker, so it stays in.
 */
export function TabSessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (status === "authenticated" && !tabIsAuthenticated()) {
      setSigningOut(true)
      signOut({ callbackUrl: "/login" })
    }
  }, [status])

  // Hold the UI back while signing out so the protected content never flashes.
  if (signingOut) return null
  return <>{children}</>
}
