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


// Mirrors general/values.ts (dealOrNoDeal) and the case tables in commands/games/dealOrNoDeal.ts in the bot repo.
export const dondValues = {
  effectItemChance: 50, // percent chance a bank offer is an effect instead of chips
  offerBase: 0.5,
  offerPerRound: 0.05,
}

export type DondTier = "basic" | "premium" | "elite"

/** Case values per tier - 26 cases each, shuffled per game. */
export const DOND_CASES: Record<DondTier, number[]> = {
  basic: [1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 10000],
  premium: [1, 5, 10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12500, 14000, 16000, 18000, 20000],
  elite: [1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000, 12500, 15000, 17500, 20000, 22500, 25000, 30000, 35000, 40000, 45000, 50000],
}

export const DOND_TIER_K: Record<DondTier, number> = { basic: 10, premium: 20, elite: 50 }

// Mirrors general/values.ts (blackjack) in the bot repo.
export const blackjackValues = {
  deathrollRefundEnabled: true, // "tilbakelegg": half of a lost deathroll-pot stake goes back to the pot
}

// Payouts mirror the bot's /rulett (commands/money/gamblingCommands.ts); the timings are specific to the shared table.
export const rouletteValues = {
  /** A number (0-36) pays this many times the stake, stake included. */
  numberPayout: 36,
  /** Red / black / odd / even pay this many times the stake, stake included. */
  categoryPayout: 2,
  red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
  minBet: 1,
  /** How long bets are open each round. */
  bettingMs: 25000,
  /** How long the result stays up before the next round opens - long enough for the whole show below plus a moment to read the outcome. */
  resultMs: 14000,
  /** The wheel grows for a moment (about 0.7s), then there is a pause before the ball is launched: result -> spin. */
  spinDelayMs: 1700,
  /** The wheel animation itself, shown before the outcome text and the new balance. */
  spinMs: 8000,
  /** The ball stays on the winning number this long before the wheel shrinks back. */
  holdMs: 2000,
  /** The server keeps accepting a bet request that arrived before the deadline for this long after it, so a request already
   * in flight isn't lost to the spin - nothing new is accepted past the deadline itself. */
  lateBetGraceMs: 4000,
  /** When every player with a bet has hit Spin: bets close immediately and the wheel starts this long after. */
  forcedSpinDelayMs: 1500,
}
