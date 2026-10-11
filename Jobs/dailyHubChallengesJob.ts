import { MazariniClient } from '../client/MazariniClient'
import { getCountryOutlinePath, getOutlineCapableCcn3s } from '../helpers/countryOutlineHelper'
import { JobStatus } from '../helpers/emojiHelper'
import { IDailyHubChallenges, IDailyHubCountryChallenge, IDailyHubOutlineChallenge, MazariniUser } from '../interfaces/database/databaseInterface'
import { RandomUtils } from '../utils/randomUtils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldCountries = require('world-countries')

interface Country {
    name: { common: string }
    capital?: string[]
    cca2: string
    cca3?: string
    ccn3?: string
    independent?: boolean
}

const DISTRACTOR_COUNT = 3
/** How many flags / outlines / capitals each daily game has. The Activities app reads the count off the stored items, so this is the only place to change it. */
const ITEMS_PER_GAME = 3

/** `world-countries` is where capitals come from, and its latest release (5.1.0, Feb 2025) predates capitals that have changed since. These win over it.
 * Same list as CAPITAL_OVERRIDES in the Activities app's lib/capitalOverrides.ts - kept in sync by hand. */
const CAPITAL_OVERRIDES: Record<string, string> = {
    // Moved from Malabo by presidential decree, 3 January 2026
    'Equatorial Guinea': 'Ciudad de la Paz',
}
const capitalOf = (c: Country): string | undefined => CAPITAL_OVERRIDES[c.name.common] ?? c.capital?.[0]

function shuffled<T>(items: T[]): T[] {
    return RandomUtils.shuffleList([...items])
}

function pickDistractors<T>(pool: T[], exclude: T, count: number): T[] {
    const candidates = pool.filter((item) => item !== exclude)
    return shuffled(candidates).slice(0, count)
}

/** Picks a random country not in `previous` (falls back to the full pool once every candidate has been used),
 * and returns the updated history - mirrors More or Less's `previous` cycling in Jobs/dailyJobs.ts. */
function pickWithHistory(pool: Country[], previous: string[]): { picked: Country; newPrevious: string[] } {
    const candidates = pool.filter((c) => !previous.includes(c.name.common))
    const picked = RandomUtils.getRandomItemFromList(candidates.length > 0 ? candidates : pool)
    const newPrevious = previous.includes(picked.name.common) ? [picked.name.common] : [...previous, picked.name.common]
    return { picked, newPrevious }
}

/** `count` different countries in a row, each picked the way pickWithHistory does, with the history carried from one to the next. */
function pickManyWithHistory(pool: Country[], previous: string[], count: number): { picked: Country[]; history: string[] } {
    const picked: Country[] = []
    let history = previous
    for (let i = 0; i < count; i++) {
        const available = pool.filter((c) => !picked.includes(c))
        const next = pickWithHistory(available, history)
        picked.push(next.picked)
        history = next.newPrevious
    }
    return { picked, history }
}

/** Flag image URL for a country - flagcdn.com is a free, keyless CDN, so this needs no live "list
 * countries" API call at all (REST Countries' v3.1 API was deprecated without warning - see the
 * git history here - so this data now comes from the bundled `world-countries` package instead). */
function flagPngUrl(cca2: string): string {
    return `https://flagcdn.com/w320/${cca2.toLowerCase()}.png`
}

// Dependent territories (French Guiana, Puerto Rico, etc.) shouldn't turn up as a Flag/Capital/Outline
// answer - `independent` is world-countries' own flag for exactly this. A few are kept in anyway
// despite being tagged `independent: false` there - contested-statehood cases (Taiwan, Palestine) or
// widely-known distinct territories (Hong Kong, Western Sahara), not simple "just part of another country" ones.
const KEEP_DESPITE_DEPENDENT = new Set(['Hong Kong', 'Taiwan', 'Palestine', 'Western Sahara'])
function getCountries(): Country[] {
    return (worldCountries as Country[]).filter((c) => c.independent !== false || KEEP_DESPITE_DEPENDENT.has(c.name.common))
}

/** Generates today's shared daily-hub puzzles (Flag, Outline, Capital) - same for every user, like the
 * existing Mastermind solution. Run once a day by the daily job. */
export async function generateDailyHubChallenges(client: MazariniClient, users: MazariniUser[]): Promise<JobStatus> {
    try {
        const countries = getCountries()
        const withCapital = countries.filter((c) => c.name?.common && capitalOf(c))
        const withFlag = countries.filter((c) => c.name?.common && c.cca2)
        const outlineCapableIds = await getOutlineCapableCcn3s()
        const withOutline = countries.filter((c) => c.name?.common && c.ccn3 && outlineCapableIds.has(c.ccn3))

        if (withCapital.length < DISTRACTOR_COUNT + 1 || withFlag.length < DISTRACTOR_COUNT + 1 || withOutline.length < DISTRACTOR_COUNT + 1) {
            return 'failed'
        }

        const history = (await client.database.getStorage()).dailyHubHistory ?? {}

        const flags = pickManyWithHistory(withFlag, history.flag ?? [], ITEMS_PER_GAME)
        const flagItems: IDailyHubCountryChallenge[] = flags.picked.map((country) => ({
            options: shuffled([country.name.common, ...pickDistractors(withFlag, country, DISTRACTOR_COUNT).map((c) => c.name.common)]),
            answer: country.name.common,
            flagPng: flagPngUrl(country.cca2),
        }))

        const capitals = pickManyWithHistory(withCapital, history.capital ?? [], ITEMS_PER_GAME)
        const capitalItems: IDailyHubCountryChallenge[] = capitals.picked.map((country) => ({
            options: shuffled([capitalOf(country), ...pickDistractors(withCapital, country, DISTRACTOR_COUNT).map(capitalOf)]),
            answer: capitalOf(country),
            countryName: country.name.common,
        }))

        // An outline has to be fetched, and one can come back empty - then the next candidate takes its place.
        const outlineItems: IDailyHubOutlineChallenge[] = []
        let outlineHistory = history.outline ?? []
        const usedOutlines: Country[] = []
        for (let tries = 0; outlineItems.length < ITEMS_PER_GAME && tries < ITEMS_PER_GAME + 5; tries++) {
            const available = withOutline.filter((c) => !usedOutlines.includes(c))
            if (available.length === 0) break
            const { picked, newPrevious } = pickWithHistory(available, outlineHistory)
            outlineHistory = newPrevious
            usedOutlines.push(picked)
            const outline = await getCountryOutlinePath(picked.ccn3, picked.cca3)
            if (!outline) continue
            outlineItems.push({
                options: shuffled([picked.name.common, ...pickDistractors(withOutline, picked, DISTRACTOR_COUNT).map((c) => c.name.common)]),
                answer: picked.name.common,
                path: outline.path,
                viewBox: outline.viewBox,
            })
        }
        if (outlineItems.length < ITEMS_PER_GAME) return 'failed'

        const challenges: IDailyHubChallenges = {
            date: new Date().toISOString().slice(0, 10),
            // The first item is spread into the top level too, so the Activities app from before there were several still has something to read.
            flag: { ...flagItems[0], items: flagItems },
            capital: { ...capitalItems[0], items: capitalItems },
            outline: { ...outlineItems[0], items: outlineItems },
        }

        client.database.updateStorage({
            dailyHubChallenges: challenges,
            dailyHubHistory: { flag: flags.history, capital: capitals.history, outline: outlineHistory },
        })
        await resetDailyHubUserStats(client, users)
        return 'success'
    } catch (err) {
        // sendLogMessage is a no-op when ENVIRONMENT=dev (see helpers/messageHelper.ts), so also log
        // to the console - otherwise a local run swallows the real error with no visibility at all.
        console.error('Daily hub-utfordringer feilet:', err)
        client.messageHelper.sendLogMessage(`Daily hub-utfordringer feilet: ${err}`)
        return 'failed'
    }
}

async function resetDailyHubUserStats(client: MazariniClient, users: MazariniUser[]) {
    // Firebase's update() rejects the whole batch if any value is `undefined` (object-spread keeps
    // the key rather than dropping it) - `null` is what actually deletes a path.
    const updates: Record<string, null> = {}
    users.forEach((user) => {
        if (!user.dailyGameStats?.flag && !user.dailyGameStats?.outline && !user.dailyGameStats?.capital) return
        const updatePath = client.database.getUserPathToUpdate(user.id, 'dailyGameStats')
        updates[`${updatePath}/flag`] = null
        updates[`${updatePath}/outline`] = null
        updates[`${updatePath}/capital`] = null
    })
    await client.database.updateData(updates)
}
