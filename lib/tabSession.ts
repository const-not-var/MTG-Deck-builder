// Per-tab auth marker.
//
// `sessionStorage` is scoped to a single tab and wiped when that tab closes, so
// it lets us enforce "log out when the tab is closed": we set the marker on
// interactive login, and <TabSessionGuard> signs out any tab that has a valid
// auth cookie but no marker (i.e. a freshly opened/reopened tab). A plain login
// cookie can't do this — closing one tab doesn't end the browser session, and
// browsers restore session cookies on relaunch.
export const TAB_AUTH_KEY = "cv_tab_authed"

export function markTabAuthenticated() {
  try { sessionStorage.setItem(TAB_AUTH_KEY, "1") } catch { /* storage unavailable */ }
}

export function tabIsAuthenticated() {
  try { return sessionStorage.getItem(TAB_AUTH_KEY) === "1" } catch { return false }
}
