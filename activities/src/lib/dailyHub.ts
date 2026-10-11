// Mirrors interfaces/database/databaseInterface.ts in the bot repo - IDailyGameStats / IMastermindStats /
// IDailyHubChallenges. Kept in sync by hand since the two apps can't share TS types directly.

import { MAX_REWARDED_CHALLENGES_PER_DAY } from "./gameValues"

export interface GameStat {
  attempted?: boolean
  completed?: boolean
  numAttempts?: number
  /** Flag/outline/capital: how many of the day's items are settled (right, out of attempts or skipped). Missing on a save from before there were several. */
  index?: number
  /** ...and how many of those were right */
  correct?: number
  /** Wrong guesses so far on the item being played */
  itemAttempts?: number
  /** How many items the game had when this was saved. Missing (= 1) on a save from before there were several. */
  total?: number
}

export interface DailyGameStats {
  flag?: GameStat
  outline?: GameStat
  capital?: GameStat
  mastermind?: GameStat
}

export interface CountryChallenge {
  options: string[]
  answer: string
  flagPng?: string
  countryName?: string
  /** Every item of the day for this game, in play order (the first is also spread into the fields above). Missing on a puzzle made before there were several. */
  items?: CountryChallenge[]
  /** Outline items - the path to draw and the box to draw it in */
  path?: string
  viewBox?: string
}

export interface OutlineChallenge {
  options: string[]
  answer: string
  path: string
  viewBox: string
}

export interface DailyHubChallenges {
  date: string
  flag: CountryChallenge
  capital: CountryChallenge
  outline: OutlineChallenge
}

/** The day's items for a flag/outline/capital game - the puzzle itself when it was made before there were several. */
export function challengeItems(challenge: CountryChallenge): CountryChallenge[] {
  return challenge.items && challenge.items.length > 0 ? challenge.items : [challenge]
}

/** How many of {flag, outline, capital, mastermind} the user has played through today (all items of a country game settled, or mastermind solved). */
export function getChallengesCompletedCount(stats: DailyGameStats | undefined): number {
  if (!stats) return 0
  return ["flag", "outline", "capital", "mastermind"].filter((key) => stats[key as keyof DailyGameStats]?.completed).length
}

/** How many of them took a rewarded slot: only the one-item games count (a game with several pays per item instead), and only the solved ones. */
export function getRewardedSlotsUsed(stats: DailyGameStats | undefined): number {
  if (!stats) return 0
  return ["flag", "outline", "capital", "mastermind"].filter((key) => {
    const stat = stats[key as keyof DailyGameStats]
    return stat?.completed && (stat.total ?? 1) === 1
  }).length
}

/** Only matters while the country games have one item each - see MAX_REWARDED_CHALLENGES_PER_DAY. */
export function hasRewardedSlotsLeft(stats: DailyGameStats | undefined): boolean {
  return getRewardedSlotsUsed(stats) < MAX_REWARDED_CHALLENGES_PER_DAY
}

/** Public-safe view of a country/outline challenge - strips `answer` (and the other items, with theirs) so it's never sent to the client. */
export function publicChallenge<T extends { answer: string }>(challenge: T): Omit<T, "answer" | "items" | "options"> {
  const { answer, items, options, ...rest } = challenge as T & { items?: unknown; options?: unknown }
  return rest
}
