import countries from "world-countries"
import { capitalOf } from "./capitalOverrides"

type LatLng = [number, number]


function findCountryByName(name: string) {
  return countries.find((c) => c.name.common.toLowerCase() === name.toLowerCase())
}

function findCountryByCapital(name: string) {
  return countries.find((c) => capitalOf(c)?.toLowerCase() === name.toLowerCase())
}

/** `kind` says whether `name` is a country name (Flag/Outline) or a capital city name (Capital). */
export function getLatLng(kind: "country" | "capital", name: string): LatLng | undefined {
  const country = kind === "capital" ? findCountryByCapital(name) : findCountryByName(name)
  const latlng = country?.latlng
  return latlng && latlng.length === 2 ? (latlng as LatLng) : undefined
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

export function distanceKm([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Initial great-circle bearing from `from` toward `to`, in degrees clockwise from north (0-360). */
export function bearingDegrees([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1))
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
}

/** Direction + rounded distance from a wrong guess toward the real answer, or undefined if either
 * name isn't recognized (a typo, say) - never crashes the guess flow, just skips the hint. */
export function getGuessHint(kind: "country" | "capital", guessedName: string, answerName: string): { bearing: number; distanceKm: number } | undefined {
  const from = getLatLng(kind, guessedName)
  const to = getLatLng(kind, answerName)
  if (!from || !to) return undefined
  return { bearing: Math.round(bearingDegrees(from, to)), distanceKm: Math.round(distanceKm(from, to)) }
}
