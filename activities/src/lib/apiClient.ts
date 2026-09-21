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
    const err = new Error(body.error ?? `Request to ${path} failed (${response.status})`)
    // Some routes attach a server-side stack while a specific bug is being chased (see their own
    // comments) - tack it onto the message so it's visible wherever the caller just does err.message.
    if (body.stack) err.message += `\n\n${body.stack}`
    throw err
  }
  return response.json()
}
