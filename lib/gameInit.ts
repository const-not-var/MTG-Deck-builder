import type { Deck, CardInDeck } from "@/types"
import type { GameCard, PlayerState } from "@/types/game"

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function cardToGameCard(card: CardInDeck, playerId: string, idx: number): GameCard {
  return {
    instanceId: `${playerId.slice(-6)}-${card.scryfallId.slice(0, 8)}-${idx}`,
    scryfallId: card.scryfallId,
    name: card.name,
    imageUri: card.imageUri,
    imageUriBack: card.imageUriBack,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    manaCost: card.manaCost,
    cmc: card.cmc,
    colorIdentity: card.colorIdentity,
    tapped: false,
    counters: {},
    loyalty: card.loyalty,
  }
}

export function initPlayerState(
  userId: string,
  userName: string,
  seatIndex: number,
  deck: Deck
): PlayerState {
  const commandZone: GameCard[] = []
  const libCards: GameCard[] = []
  let idx = 0

  for (const card of deck.cards) {
    for (let q = 0; q < card.quantity; q++) {
      const gc = cardToGameCard(card, userId, idx++)
      if (card.isCommander || card.isCompanion) {
        commandZone.push(gc)
      } else {
        libCards.push(gc)
      }
    }
  }

  const library = shuffleArray(libCards)
  const hand = library.splice(0, 7)

  return {
    userId,
    userName,
    seatIndex,
    deckId: deck._id,
    life: 40,
    commanderDamage: {},
    hand,
    library,
    libraryCount: library.length,
    battlefield: [],
    graveyard: [],
    exile: [],
    commandZone,
    cmdCastCount: {},
    joined: true,
  }
}

export function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}
