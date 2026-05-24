# Commander Vault

A full-stack Magic: The Gathering Commander deck builder with live TCGPlayer prices, card search, and deck validation.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript) ![MongoDB](https://img.shields.io/badge/MongoDB-local-green?logo=mongodb)

## Features

- **Card Search** — Live autocomplete powered by the Scryfall API. Hover any suggestion to preview the full card art and oracle text.
- **Live TCGPlayer Prices** — Every card shows its current market price. Total deck value updates in real time as you build.
- **Commander Validation** — Enforces the 100-card limit, color identity rules, and duplicate restrictions as you add cards.
- **Mana Curve Chart** — Visual breakdown of your deck's mana costs so you can spot curve problems at a glance.
- **User Accounts** — Register and log in to save your decks. Each account has its own private deck collection.
- **Deck Management** — Create, rename, save, and delete decks. Commander card art automatically becomes the deck thumbnail.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | NextAuth.js v5 |
| Database | MongoDB + Mongoose |
| Card Data | [Scryfall API](https://scryfall.com/docs/api) (free, no key needed) |
| Charts | Recharts |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- Node.js 22+
- MongoDB (local or Atlas)

### Install MongoDB locally

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

### Setup

```bash
git clone https://github.com/const-not-var/MTG-Deck-builder.git
cd MTG-Deck-builder
npm install
```

Create `.env.local` in the project root:

```env
MONGODB_URI=mongodb://localhost:27017
AUTH_SECRET=your_random_secret_here   # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start building.

## Project Structure

```
app/
├── (auth)/login & register   # Auth pages
├── decks/                    # Deck list + editor
└── api/                      # REST API routes
components/
├── CardSearch.tsx            # Scryfall autocomplete + hover preview
├── DeckEditor.tsx            # 3-panel editor (search | cards | stats)
├── DeckStats.tsx             # Price totals, curve, validation messages
└── ManaCurve.tsx             # Recharts bar chart
lib/
├── scryfall.ts               # Scryfall API helpers
└── validation.ts             # Commander rules engine
models/
└── User.ts / Deck.ts         # Mongoose schemas
```
