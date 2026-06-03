"use client"

import { SessionProvider } from "next-auth/react"
import { IdleLogout } from "@/components/IdleLogout"
import { TabSessionGuard } from "@/components/TabSessionGuard"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleLogout />
      <TabSessionGuard>{children}</TabSessionGuard>
    </SessionProvider>
  )
}
