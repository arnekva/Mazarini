// The `world-countries` package is how every capital gets here, and its latest release (5.1.0, Feb 2025) predates capitals that have changed since.
// Anything listed here wins over the package. Same list as CAPITAL_OVERRIDES in the bot repo's Jobs/dailyHubChallengesJob.ts - kept in sync by hand.
export const CAPITAL_OVERRIDES: Record<string, string> = {
  // Moved from Malabo by presidential decree, 3 January 2026
  "Equatorial Guinea": "Ciudad de la Paz",
}

/** The capital to use for a country: the override if there is one, otherwise what the package says. */
export function capitalOf(country: { name: { common: string }; capital?: string[] }): string | undefined {
  return CAPITAL_OVERRIDES[country.name.common] ?? country.capital?.[0]
}
