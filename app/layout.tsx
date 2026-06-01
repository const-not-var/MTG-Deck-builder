import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Toaster } from "sonner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Commander Vault — MTG Deck Builder",
  description: "Build and manage your Magic: The Gathering Commander decks with live TCGPlayer prices.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" theme="dark" richColors />
        <footer className="hidden md:block fixed bottom-0 inset-x-0 z-20 pb-1 text-center pointer-events-none">
          <p className="text-[9px] leading-none" style={{ color: "rgba(255,255,255,0.12)" }}>
            commandervault.net is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. ©Wizards of the Coast LLC.
          </p>
        </footer>
      </body>
    </html>
  )
}
