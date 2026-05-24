import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtected =
        nextUrl.pathname.startsWith("/decks") || nextUrl.pathname === "/"
      const isAuthRoute =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register"

      if (isProtected && !isLoggedIn) return false
      if (isAuthRoute && isLoggedIn)
        return Response.redirect(new URL("/decks", nextUrl))
      return true
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}
