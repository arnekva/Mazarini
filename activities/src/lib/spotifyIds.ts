export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/playlist[/:]([a-zA-Z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9]{10,}$/.test(trimmed)) return trimmed
  return null
}
