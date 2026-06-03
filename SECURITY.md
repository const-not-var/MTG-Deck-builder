# Security & Hardening Notes

## Threat model

Commander Vault is a **casual, friends-trusted** multiplayer app. The hardening
goal is to be **robust against accidental and malicious malformed/abusive input**
(no request should be able to crash the server, corrupt data, or abuse third-party
APIs), while **not** enforcing game rules against trusted players (the shared-table
model is intentional — e.g. a player may set their own life total freely). All
mutating routes require an authenticated session.

---

## Phase 1 — backend validation, crash-safety, authorization (done)

Validation is centralized in `lib/api.ts` (Zod schemas + a safe `readJson` helper).

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | High | Game `PATCH` accepted an unvalidated `action`; a bad zone (e.g. `fromZone:"life"`) made the reducer call `.findIndex` on a non-array → uncaught `TypeError` → **500 DoS**. | `gameActionSchema` (discriminated union, bounded fields) validates before the reducer; `applyAction` wrapped in try/catch → **400**. |
| 2 | High | Any authenticated user could `PATCH` any game by code (no membership check). | `PATCH` now returns **403** unless the caller is a joined player or the host. |
| 3 | High (functional) | Registration stored `email` lowercased, but login queried the **raw** email → any mixed-case login failed. | Login query lowercases the email to match. |
| 4 | Med | Malformed `ObjectId` in `/api/decks/[id]` (GET/PUT/DELETE) → `CastError` → **500**. | `isValidObjectId` guards → 404. |
| 5 | Med | Malformed `deckId` in game join → `CastError` → **500**. | `isValidObjectId` guard → 400. |
| 6 | Med | `/api/cards/{import,enrich,salt}` accepted **unbounded** name/id arrays → long-running functions + risk of getting the app's User-Agent rate-limited/banned by Scryfall/EDHREC. | Capped (`names`/`ids` ≤ 2000) via Zod; safe JSON parsing. |
| 7 | Med | Deck create/update accepted **unbounded/unvalidated** `cards` → oversized documents. | `deckCreateSchema`/`deckUpdateSchema`: `cards` ≤ 1000, bounded fields, names/description length caps. |
| 8 | Med | Several routes did `await req.json()` unguarded → **500** on malformed JSON body. | `readJson()` returns null instead of throwing; routes 400 on bad input. |
| 9 | Low | Password-reset email injected `user.name` into HTML unescaped (self-XSS in the recipient's mail client). | HTML-escaped before interpolation. |
| 10 | Info | Registration had no email-format/length validation. | `registerSchema` (email format, name ≤ 80, password 8–200). |

### Already solid (verified, unchanged)
- Auth rate-limiting on register / login / forgot / reset (`lib/rateLimit.ts`); bcrypt cost 12.
- Forgot-password is account-enumeration-safe (always returns the same message).
- Reset tokens are random (`crypto.randomBytes(32)`) and expire in 1 hour.
- Deck routes enforce ownership (`{ _id, userId }`).
- Game state: opponents' hands/libraries are redacted on GET *and* PATCH responses; writes are optimistic-concurrency (`__v`) guarded; actions only ever mutate the acting player's own state.

## End-to-end tests (Playwright)

Critical flows are exercised by a real headless browser — `e2e/` + `playwright.config.ts`.

```bash
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive
```

- Runs against a **dedicated server on port 3100** with an **isolated test database**
  (`commandervault_e2e`), dropped clean before each run (`e2e/global-setup.ts`) — it
  never touches real data.
- The server is started with `E2E_TEST=1`, which disables IP rate-limiting so the
  suite can create many accounts from one IP. **This flag is never set in production.**
- **Hermetic** — it does a production build/start into an isolated `.next-e2e` dir
  (via `E2E_DISTDIR`), so it runs fine **alongside a running `next dev`** (which owns
  `.next`). Requires MongoDB to be running.
- **Runs automatically on `git push`** via a Husky `pre-push` hook (`.husky/pre-push`).
  Bypass in a pinch with `git push --no-verify`.
- Projects: `desktop` (Chrome 1280×800) and `mobile` (Pixel 7). Coverage: auth
  (register/login, case-insensitive email, bad-password), deck create/import/delete +
  validation 400s, malformed-id 404, game lobby, malformed-action 400, non-member 403,
  mobile (auth, import reachable on a phone, game desktop-gate), a **2-player live
  game** (lobby → mulligan → drag-to-play → cross-player sync + hand redaction), and
  a console-error guard that fails on any uncaught exception / `console.error`.

### Accepted by design (trust model)
- Any authenticated user may `GET` a game by code (spectate the public board — hands stay redacted). Codes are 6 chars of a 32-symbol alphabet (~1e9 space); guessing is impractical. Left open so players can view a lobby before joining.
- Players may freely adjust their own life/counters (no rule enforcement).
- `/api/cards/search` and `/api/cards/printings` are unauthenticated public Scryfall proxies (used by public deck pages). Candidate for per-IP rate-limiting if abuse appears.
