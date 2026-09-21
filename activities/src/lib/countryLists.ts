import countries from "world-countries"

// Matches Jobs/dailyHubChallengesJob.ts on the bot side - dependent territories (French Guiana,
// Puerto Rico, etc.) are never a valid answer, so they shouldn't be offered as suggestions either.
// A few are kept in despite being tagged `independent: false` there - see that file for why.
const KEEP_DESPITE_DEPENDENT = new Set(["Hong Kong", "Taiwan", "Palestine", "Western Sahara"])
const sovereign = countries.filter((c) => c.independent !== false || KEEP_DESPITE_DEPENDENT.has(c.name.common))

// Suggestion sources for the free-text typeahead - not the source of truth for a correct answer
// (the server holds that), just what the UI offers to autocomplete against.
export const countryNames = sovereign.map((c) => c.name.common).sort()
export const capitalNames = sovereign.filter((c) => c.capital?.[0]).map((c) => c.capital[0]).sort()
