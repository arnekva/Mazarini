/** Seasonal themes. The active one is picked on the server from today's date (Norwegian time) and set as `data-theme` on <html> -
 * see app/layout.tsx. A theme is then just CSS scoped to `:root[data-theme="<id>"]` (overriding the colour variables in
 * globals.css, plus anything else it wants) and, optionally, a decoration layer (see ThemeDecor).
 *
 * Adding a theme:
 *  1. add it to THEMES below, with the dates it runs
 *  2. create src/themes/<id>/<id>.css, plus a <Id>Decor component that imports it (and draws any decorations - it can be just the
 *     wrapper div), and add that component to ThemeDecor
 * Shared pieces are in src/themes/shared (falling leaves/snow, ...), and a theme can set --theme-card-back(-bg/-border) for blackjack.
 * Try it out any time of year with ?theme=<id> (or ?theme=none) - see ThemeOverride. */

export interface DayOfYear {
  /** 1-12 */
  month: number
  day: number
}

export interface ThemeDefinition {
  id: string
  name: string
  /** "light" for a daytime theme: dark text on light cards (see themes/shared/light.css, set as data-tone on <html>). Default dark. */
  tone?: "light"
  /** Whether the theme is on for this day. Most themes are a fixed range (see between); a moving holiday like Easter can compute it. */
  isActive: (date: DayOfYear & { year: number }) => boolean
}

/** Every day from `from` to `to`, both included. A range may cross new year (e.g. Dec 1 - Feb 28). */
export function between(from: DayOfYear, to: DayOfYear): ThemeDefinition["isActive"] {
  const key = (d: DayOfYear) => d.month * 100 + d.day
  return (date) => (key(from) <= key(to) ? key(date) >= key(from) && key(date) <= key(to) : key(date) >= key(from) || key(date) <= key(to))
}

/** Christmas starts on the first Sunday of Advent or December 1st, whichever comes first. Advent Sunday is the fourth Sunday before
 * Christmas Day, so it always falls between November 27th and December 3rd. */
export function christmasStart(year: number): DayOfYear {
  const christmasDay = new Date(Date.UTC(year, 11, 25))
  // The Sunday before Christmas Day (a week before, if Christmas Day is itself a Sunday), then three more Sundays back.
  const fourthAdvent = new Date(christmasDay)
  fourthAdvent.setUTCDate(25 - (christmasDay.getUTCDay() || 7))
  const firstAdvent = new Date(fourthAdvent)
  firstAdvent.setUTCDate(fourthAdvent.getUTCDate() - 21)
  const first = { month: firstAdvent.getUTCMonth() + 1, day: firstAdvent.getUTCDate() }
  return first.month === 11 ? first : { month: 12, day: 1 }
}

const dayBefore = (d: DayOfYear): DayOfYear => (d.day > 1 ? { month: d.month, day: d.day - 1 } : { month: 11, day: 30 })

/** First match wins - put the narrower themes (a holiday) before the broader ones (a season) they overlap. */
export const THEMES: ThemeDefinition[] = [
  { id: "spooktober", name: "Spooktober", isActive: between({ month: 10, day: 1 }, { month: 10, day: 31 }) },
  { id: "autumn", name: "Høst", isActive: (date) => between({ month: 11, day: 1 }, dayBefore(christmasStart(date.year)))(date) },
  { id: "christmas", name: "Jul", isActive: (date) => between(christmasStart(date.year), { month: 12, day: 29 })(date) },
  { id: "newyearseve", name: "Nyttårsaften", isActive: between({ month: 12, day: 30 }, { month: 12, day: 31 }) },
  { id: "hangover", name: "Første nyttårsdag", isActive: between({ month: 1, day: 1 }, { month: 1, day: 1 }) },
  { id: "winter", name: "Vinter", isActive: between({ month: 1, day: 2 }, { month: 2, day: 29 }) },
  { id: "spring", name: "Vår", tone: "light", isActive: between({ month: 3, day: 1 }, { month: 5, day: 14 }) },
  { id: "syttendemai", name: "17. mai", tone: "light", isActive: between({ month: 5, day: 15 }, { month: 5, day: 17 }) },
  { id: "earlysummer", name: "Forsommer", tone: "light", isActive: between({ month: 5, day: 18 }, { month: 6, day: 20 }) },
  { id: "summer", name: "Sommerferie", tone: "light", isActive: between({ month: 6, day: 21 }, { month: 8, day: 10 }) },
  { id: "backtowork", name: "Tilbake på jobb", isActive: between({ month: 8, day: 11 }, { month: 9, day: 30 }) },
]

/** Today as it is in Norway, whatever timezone the server runs in. */
function norwegianDate(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now).map((p) => [p.type, p.value])
  )
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }
}

export function activeTheme(now = new Date()): ThemeDefinition | undefined {
  const today = norwegianDate(now)
  return THEMES.find((theme) => theme.isActive(today))
}

export function themeById(id: string): ThemeDefinition | undefined {
  return THEMES.find((theme) => theme.id === id)
}
