function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const curr = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[n]
}

/** Shorter words tolerate fewer typos - a 1-letter slip on a 4-letter capital is much more likely
 * to land on a different real word than the same slip on a 10-letter one. */
function toleranceFor(length: number): number {
  if (length <= 4) return 1
  if (length <= 8) return 2
  return 3
}

/**
 * Finds the closest candidate to `input` by edit distance, for a "did you mean X?" prompt.
 * Returns null if input is an exact match already, or if nothing is close enough to be a plausible typo.
 */
export function findDidYouMean(input: string, candidates: string[]): string | null {
  const query = input.trim().toLowerCase()
  if (!query) return null

  let best: { candidate: string; distance: number } | null = null
  for (const candidate of candidates) {
    const normalized = candidate.trim().toLowerCase()
    if (normalized === query) return null // exact match - nothing to suggest
    const distance = levenshtein(query, normalized)
    if (!best || distance < best.distance) best = { candidate, distance }
  }

  if (!best) return null
  if (best.distance === 0) return null
  if (best.distance > toleranceFor(query.length)) return null
  return best.candidate
}
