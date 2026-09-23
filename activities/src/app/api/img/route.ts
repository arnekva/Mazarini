// Discord's Activity CSP only allows img-src 'self' (+ Discord's own CDN) - any external image URL
// has to be re-served from our own origin to actually load. Restricted to known-safe hosts so this
// can't be used as an open image-fetching relay. More or Less's item images are served per-category
// from *.pages.dev subdomains (confirmed varies: enjoy-i.pages.dev, go-image.pages.dev, ...), so
// that one's a suffix match rather than an exact host. cdn.discordapp.com is player/spectator
// avatars (see discordAvatarUrl in lib/discordAvatar.ts) - Discord's CDN would actually be allowed
// directly by the CSP, but everything still goes through this same proxy for one consistent path.
const ALLOWED_EXACT_HOSTS = ["flagcdn.com", "api.moreorless.io", "cdn.discordapp.com"]
const ALLOWED_HOST_SUFFIXES = [".pages.dev"]

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_EXACT_HOSTS.includes(hostname) || ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url")
  if (!target) return new Response("Missing url", { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return new Response("Invalid url", { status: 400 })
  }
  if (!isAllowedHost(parsed.hostname)) return new Response("Host not allowed", { status: 400 })

  const upstream = await fetch(parsed.toString())
  if (!upstream.ok || !upstream.body) return new Response("Upstream fetch failed", { status: 502 })

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
