// Mirrors interfaces/database/databaseInterface.ts in the bot repo - IDailyGameStats / IMastermindStats /
// IDailyHubChallenges. Kept in sync by hand since the two apps can't share TS types directly.

import { MAX_REWARDED_CHALLENGES_PER_DAY } from "./gameValues"

export interface GameStat {
  attempted?: boolean
  completed?: boolean
  numAttempts?: number
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

/** How many of {flag, outline, capital, mastermind} the user has *completed* today - losses don't count. */
export function getChallengesCompletedCount(stats: DailyGameStats | undefined): number {
  if (!stats) return 0
  return ["flag", "outline", "capital", "mastermind"].filter((key) => stats[key as keyof DailyGameStats]?.completed).length
}

export function hasRewardedSlotsLeft(stats: DailyGameStats | undefined): boolean {
  return getChallengesCompletedCount(stats) < MAX_REWARDED_CHALLENGES_PER_DAY
}

/** Public-safe view of a country/outline challenge - strips `answer` so it's never sent to the client. */
export function publicChallenge<T extends { answer: string }>(challenge: T): Omit<T, "answer"> {
  const { answer, ...rest } = challenge
  return rest
}
