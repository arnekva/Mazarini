export function getRndInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getRndBetween0and100() {
    return getRndInteger(0, 100)
}

/**
 * Check if a random integer between 0 and 100 is lower than the provided parameter
 */
export function getRandomPercentage(perc: number) {
    return getRndInteger(0, 100) < perc
}
