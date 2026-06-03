"use client"

import { useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"

const IDLE_MS = 30 * 60 * 1000 // 30 minutes of no interaction → sign out

// Signs an authenticated user out after a stretch of inactivity, even if their tab
// is just sitting open (the server session also expires on its own; this catches
// the idle-open-tab case and redirects to login).
export function IdleLogout() {
  const { status } = useSession()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => signOut({ callbackUrl: "/login" }), IDLE_MS)
    }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"]
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [status])

  return null
}
