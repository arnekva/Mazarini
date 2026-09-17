"use client"

// Thin fetch wrapper for calling our own API routes from client components: every game action
// needs the caller's Discord access token attached so the server can re-verify who's asking.
export async function callApi<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Request to ${path} failed (${response.status})`)
  }
  return response.json()
}
