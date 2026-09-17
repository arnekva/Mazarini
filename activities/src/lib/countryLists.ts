import countries from "world-countries"

// Suggestion sources for the free-text typeahead - not the source of truth for a correct answer
// (the server holds that), just what the UI offers to autocomplete against.
export const countryNames = countries.map((c) => c.name.common).sort()
export const capitalNames = countries.filter((c) => c.capital?.[0]).map((c) => c.capital[0]).sort()
