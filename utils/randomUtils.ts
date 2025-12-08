const crypto = require('crypto')
export namespace RandomUtils {
    /** Includes both min and max */
    export function getRandomInteger(min: number, max: number, test?: boolean): number {
        if (test) return 102
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

    export function getRandomIntegerExcludingNumber(length: number, exclude: number) {
        let num = Math.floor(Math.random() * length)
        if (num == exclude) num = (num + 1) % length
        return num
    }

    export function getRandomItemFromList(list: any[]) {
        return list[Math.floor(Math.random() * list.length)]
    }

    export type WeightedItem = { value: number; weight: number }
    export function chooseWeightedItem(items: WeightedItem[]): number {
        // Calculate the total weight sum
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)

        // Generate a random number between 0 and totalWeight
        let random = Math.random() * totalWeight

        // Iterate over the items and return the one where the cumulative weight exceeds random
        for (const item of items) {
            if (random < item.weight) {
                return item.value
            }
            random -= item.weight
        }

        // Fallback return; in theory this shouldn't be reached
        return items[items.length - 1].value
    }

    export function shuffleList(list: any[]) {
        return list
            .map((item) => ({ item, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ item }) => item)
    }
}
