export interface ScryfallCard {
  id: string
  name: string
  mana_cost?: string
  cmc: number
  type_line: string
  oracle_text?: string
  color_identity: string[]
  image_uris?: {
    small: string
    normal: string
    large: string
  }
  card_faces?: Array<{
    image_uris?: { small: string; normal: string; large: string }
    name: string
    mana_cost?: string
  }>
  prices: {
    usd: string | null
    usd_foil: string | null
  }
  legalities: {
    commander: string
  }
  power?: string
  toughness?: string
  loyalty?: string
  set_name?: string
  set?: string
  collector_number?: string
  lang?: string
  foil?: boolean
  nonfoil?: boolean
  released_at?: string
}

export interface CardInDeck {
  scryfallId: string
  name: string
  quantity: number
  cmc: number
  typeLine: string
  colorIdentity: string[]
  manaCost: string
  prices: {
    usd?: string
    usdFoil?: string
  }
  imageUri: string
  isCommander: boolean
}

export interface Deck {
  _id: string
  userId: string
  name: string
  description: string
  cards: CardInDeck[]
  createdAt: string
  updatedAt: string
}

export interface DeckValidation {
  isValid: boolean
  cardCount: number
  commanderCount: number
  duplicates: string[]
  colorViolations: string[]
  errors: string[]
  warnings: string[]
}
