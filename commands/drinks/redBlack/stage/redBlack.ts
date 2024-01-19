import { ICardObject } from '../../../games/cardCommands'
import { RedBlackCommands } from '../redBlackCommands'
import { RedBlackRound } from '../redBlackInterfaces'

export class RedBlack {
    public static async guessRB(card: ICardObject, guess: string) {
        return guess === 'red' ? ['H', 'D'].includes(card.suit) : ['S', 'C'].includes(card.suit)
    }

    public static async guessUD(card: ICardObject, prevCards: ICardObject[], guess: string) {
        const prevCard = prevCards.pop()
        const guessIsUp = guess === 'up'
        const guessIsDown = guess === 'down'
        const guessIsSame = !guessIsUp && !guessIsDown
        const oldAceIfExists = prevCards.find((card) => card.number === 14)
        const currPlayerHasAce = !!oldAceIfExists

        const findAceValue = () => {
            //If a player has gotten an Ace in round one, and by chance gets a second one in round two, it is still undefined since it's incorrect (or correct if guessing "likt") either way.
            if (guessIsSame || (!RedBlackCommands.aceValue && card.number === 14)) return undefined
            //If an Ace has been drawn in first pass, or is drawn this pass for the first time, we need to
            //find the correct value - it should always be the opposite of what the player guesses, such that he always loses the round.
            return guessIsUp ? 1 : 14
        }

        if ((card.number === 14 || currPlayerHasAce) && !RedBlackCommands.aceValue) {
            RedBlackCommands.aceValue = findAceValue()
            //Need to overwrite the existing card as well (if applicable), as it has been generated with the standard value
            if (RedBlackCommands.aceValue) {
                currPlayerHasAce ? (oldAceIfExists.number = RedBlackCommands.aceValue) : (card.number = RedBlackCommands.aceValue)
            }
        }
        if (guessIsUp) return card.number > prevCard.number
        if (guessIsDown) return card.number < prevCard.number
        return card.number == prevCard.number
    }

    public static async guessIO(card: ICardObject, prevCards: ICardObject[], guess: string) {
        const highCard = prevCards.pop()
        const lowCard = prevCards.pop()
        if (guess === 'in') return card.number > lowCard.number && card.number < highCard.number
        if (guess === 'out') return card.number < lowCard.number || card.number > highCard.number
        return card.number == highCard.number || card.number == lowCard.number
    }

    public static async guessSuit(card: ICardObject, guess: string) {
        return guess === card.suit
    }

    public static getTranslatedGuessValue(guess: string) {
        return RedBlack.guessTranslations.get(guess)
    }

    public static getPrettyRoundName(rn: RedBlackRound) {
        return RedBlack.roundPrettyName.get(rn)
    }

    static roundPrettyName: Map<RedBlackRound, string> = new Map<RedBlackRound, string>([
        [RedBlackRound.RedBlack, 'Rød eller svart'],
        [RedBlackRound.InsideOutside, 'Innenfor eller utenfor'],
        [RedBlackRound.UpDown, 'Opp eller ned'],
        [RedBlackRound.Suit, 'Hvilken type'],
    ])
    static guessTranslations: Map<string, string> = new Map<string, string>([
        ['red', 'rød'],
        ['black', 'svart'],
        ['up', 'opp'],
        ['down', 'ned'],
        ['same', 'likt'],
        ['in', 'innenfor'],
        ['out', 'utenfor'],
        ['S', ' spar '],
        ['C', ' kløver '],
        ['H', ' hjerter '],
        ['D', ' ruter '],
    ])
}
