import { MazariniClient } from '../client/MazariniClient'
import { getCountryOutlinePath, getOutlineCapableCcn3s } from '../helpers/countryOutlineHelper'
import { JobStatus } from '../helpers/emojiHelper'
import { IDailyHubChallenges, MazariniUser } from '../interfaces/database/databaseInterface'
import { RandomUtils } from '../utils/randomUtils'

interface RestCountry {
    name: { common: string }
    capital?: string[]
    flags: { png: string }
    ccn3?: string
}

const DISTRACTOR_COUNT = 3

function shuffled<T>(items: T[]): T[] {
    return RandomUtils.shuffleList([...items])
}

function pickDistractors<T>(pool: T[], exclude: T, count: number): T[] {
    const candidates = pool.filter((item) => item !== exclude)
    return shuffled(candidates).slice(0, count)
}

async function fetchCountries(): Promise<RestCountry[]> {
    const response = await fetch('https://restcountries.com/v3.1/all?fields=name,capital,flags,ccn3')
    if (!response.ok) throw new Error(`REST Countries fetch failed: ${response.status}`)
    return (await response.json()) as RestCountry[]
}

/** Generates today's shared daily-hub puzzles (Flag, Outline, Capital) - same for every user, like the
 * existing Mastermind solution. Run once a day by the daily job. */
export async function generateDailyHubChallenges(client: MazariniClient, users: MazariniUser[]): Promise<JobStatus> {
    try {
        const countries = await fetchCountries()
        const withCapital = countries.filter((c) => c.name?.common && c.capital?.[0])
        const withFlag = countries.filter((c) => c.name?.common && c.flags?.png)
        const outlineCapableIds = await getOutlineCapableCcn3s()
        const withOutline = countries.filter((c) => c.name?.common && c.ccn3 && outlineCapableIds.has(c.ccn3))

        if (withCapital.length < DISTRACTOR_COUNT + 1 || withFlag.length < DISTRACTOR_COUNT + 1 || withOutline.length < DISTRACTOR_COUNT + 1) {
            return 'failed'
        }

        const flagCountry = RandomUtils.getRandomItemFromList(withFlag)
        const flagOptions = shuffled([flagCountry.name.common, ...pickDistractors(withFlag, flagCountry, DISTRACTOR_COUNT).map((c) => c.name.common)])

        const capitalCountry = RandomUtils.getRandomItemFromList(withCapital)
        const capitalOptions = shuffled([
            capitalCountry.capital[0],
            ...pickDistractors(withCapital, capitalCountry, DISTRACTOR_COUNT).map((c) => c.capital[0]),
        ])

        const outlineCountry = RandomUtils.getRandomItemFromList(withOutline)
        const outline = await getCountryOutlinePath(outlineCountry.ccn3)
        if (!outline) return 'failed'
        const outlineOptions = shuffled([
            outlineCountry.name.common,
            ...pickDistractors(withOutline, outlineCountry, DISTRACTOR_COUNT).map((c) => c.name.common),
        ])

        const challenges: IDailyHubChallenges = {
            date: new Date().toISOString().slice(0, 10),
            flag: { options: flagOptions, answer: flagCountry.name.common, flagPng: flagCountry.flags.png },
            capital: { options: capitalOptions, answer: capitalCountry.capital[0], countryName: capitalCountry.name.common },
            outline: { options: outlineOptions, answer: outlineCountry.name.common, path: outline.path, viewBox: outline.viewBox },
        }

        client.database.updateStorage({ dailyHubChallenges: challenges })
        resetDailyHubUserStats(client, users)
        return 'success'
    } catch (err) {
        // sendLogMessage is a no-op when ENVIRONMENT=dev (see helpers/messageHelper.ts), so also log
        // to the console - otherwise a local run swallows the real error with no visibility at all.
        console.error('Daily hub-utfordringer feilet:', err)
        client.messageHelper.sendLogMessage(`Daily hub-utfordringer feilet: ${err}`)
        return 'failed'
    }
}

function resetDailyHubUserStats(client: MazariniClient, users: MazariniUser[]) {
    const updates = client.database.getUpdatesObject<'dailyGameStats'>()
    users.forEach((user) => {
        if (!user.dailyGameStats?.flag && !user.dailyGameStats?.outline && !user.dailyGameStats?.capital) return
        user.dailyGameStats = { ...user.dailyGameStats, flag: undefined, outline: undefined, capital: undefined }
        const updatePath = client.database.getUserPathToUpdate(user.id, 'dailyGameStats')
        updates[updatePath] = user.dailyGameStats
    })
    client.database.updateData(updates)
}
