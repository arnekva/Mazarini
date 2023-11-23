const crypto = require('crypto')
export namespace RandomUtils {
    /** Includes both min and max */
    export function getRandomInteger(min: number, max: number) {
        if (min < 0 || max <= 0 || max < min) return 1
        return crypto.randomInt(min, max + 1)
    }

    export function getRndBetween0and100() {
        return getRandomInteger(0, 100)
    }

    export function getUnsecureRandomInteger(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }
    /**
     * Check if a random integer between 0 and 100 is lower than the provided parameter
     */
    export function getRandomPercentage(perc: number) {
        return getRandomInteger(0, 100) < perc
    }

    export function getFiftyFifty(): boolean {
        return Math.random() < 0.5
    }

    export function getRandomIntegerExcludingIndex(arrLength: number, exclude: number) {
        let index = Math.floor(Math.random() * arrLength)
        if (index == exclude) index = (index + 1)%arrLength
        return index
    }
}
