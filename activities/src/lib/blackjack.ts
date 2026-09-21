export type Suit = "♠" | "♥" | "♦" | "♣"
export interface Card {
  rank: string
  suit: Suit
}

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"]

export function freshShuffledDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit })
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/** Best possible total for a hand, counting aces as 11 unless that would bust. */
export function handValue(hand: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of hand) {
    if (card.rank === "A") {
      total += 11
      aces++
    } else if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      total += 10
    } else {
      total += Number(card.rank)
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21
}

/** Draws one card, reshuffling a fresh deck first in the (very unlikely) case the shared deck ran dry. */
export function drawCard(deck: Card[]): { card: Card; remaining: Card[] } {
  const source = deck.length > 0 ? deck : freshShuffledDeck()
  const [card, ...remaining] = source
  return { card, remaining }
}
