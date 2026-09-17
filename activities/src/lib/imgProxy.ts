"use client"

/** Routes an external image through /api/img so it's same-origin - required by the Discord Activity CSP. */
export function proxyImageUrl(url: string): string {
  return `/api/img?url=${encodeURIComponent(url)}`
}
