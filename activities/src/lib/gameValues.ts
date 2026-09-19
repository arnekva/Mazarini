// Mirrors general/values.ts and helpers/moneyHelper.ts in the bot repo (can't import TS across the
// two apps, so these are kept in sync by hand - same numbers, same source of truth conceptually).

export const dailyClaimValues = {
  baseReward: 500,
  streakMultiplier: 1.0,
  streak7Reward: "chest" as const,
}

/** Reward is multiplied by this while the user is in jail - see helpers/moneyHelper.ts applyRestrictions. */
export const JAIL_MULTIPLIER = 0.25

/** Channel completion/reward announcements post to - placeholder until a dedicated daily-hub channel exists. */
export const ANNOUNCE_CHANNEL_ID = "808992127249678386"

/** Max rewarded challenge completions per day (flag/outline/capital/mastermind share this pool) - losses don't count against it. */
export const MAX_REWARDED_CHALLENGES_PER_DAY = 3

export const countryChallengeValues = {
  maxAttempts: 3,
  reward: 1000,
}

export const moreOrLessValues = {
  rewards: {
    tier1: 200, // 1-10
    tier2: 200, // 11-20
    tier3: 200, // 21-30
    tier4: 200, // 31-40
    tier5: 200, // 41-50
    tier6: 50, // 51+
    completed: 2500,
  },
}

export const CUSTOM_MOL_GAME_TAG = "CUSTOM_MAZARINI_GAME"

export const mastermindValues = {
  totalAttempts: 10,
  codeLength: 4,
  colors: ["red", "blue", "yellow", "green", "black", "white"] as const,
  /** reward = baseReward - perGuessPenalty * numGuesses, floored at 0 */
  baseReward: 2000,
  perGuessPenalty: 200,
}

