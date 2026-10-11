// Collapses "Song Title - 2011 Remaster" / "Song Title (Live)" / "Song Title (feat. X)" down to the
// same key as plain "Song Title", so the same song released on a single vs. an album (different
// Spotify track IDs) is recognized as a duplicate instead of two separate entries.
function normalizeTitle(name: string): string {
  return name
    .toLowerCase()
    .split(" - ")[0]
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function normalizeArtists(artists: string): string {
  return artists
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .sort()
    .join(",")
}

/** Two tracks with the same key are the same song - used both when fetching a playlist and when restoring a saved ranking. */
export function trackKey(name: string, artists: string): string {
  return `${normalizeTitle(name)}|${normalizeArtists(artists)}`
}
