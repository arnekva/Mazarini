import { MazariniClient } from '../client/MazariniClient'
import { getCountryOutlinePath, getOutlineCapableCcn3s } from '../helpers/countryOutlineHelper'
import { JobStatus } from '../helpers/emojiHelper'
import { IDailyHubChallenges, MazariniUser } from '../interfaces/database/databaseInterface'
import { RandomUtils } from '../utils/randomUtils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldCountries = require('world-countries')

interface Country {
    name: { common: string }
    capital?: string[]
    cca2: string
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

/** Flag image URL for a country - flagcdn.com is a free, keyless CDN, so this needs no live "list
 * countries" API call at all (REST Countries' v3.1 API was deprecated without warning - see the
 * git history here - so this data now comes from the bundled `world-countries` package instead). */
function flagPngUrl(cca2: string): string {
    return `https://flagcdn.com/w320/${cca2.toLowerCase()}.png`
}

function getCountries(): Country[] {
    return worldCountries as Country[]
}

/** Generates today's shared daily-hub puzzles (Flag, Outline, Capital) - same for every user, like the
 * existing Mastermind solution. Run once a day by the daily job. */
export async function generateDailyHubChallenges(client: MazariniClient, users: MazariniUser[]): Promise<JobStatus> {
    try {
        const countries = getCountries()
        const withCapital = countries.filter((c) => c.name?.common && c.capital?.[0])
        const withFlag = countries.filter((c) => c.name?.common && c.cca2)
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
            flag: { options: flagOptions, answer: flagCountry.name.common, flagPng: flagPngUrl(flagCountry.cca2) },
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
