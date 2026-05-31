import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Commander Vault — MTG Deck Builder",
  description: "Build and manage your Magic: The Gathering Commander decks with live TCGPlayer prices.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <Providers>{children}</Providers>
        <footer
          className="hidden md:block fixed bottom-0 inset-x-0 z-20 py-1 px-4 text-center"
          style={{ background: "rgba(6,7,20,0.88)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <p className="text-[10px] text-zinc-700 leading-none">
            commandervault.net is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
          </p>
        </footer>
      </body>
    </html>
  )
}
