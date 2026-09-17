import { authenticateRequest } from "@/lib/discordAuth"

// Smoke-test / debugging endpoint for the auth pattern every game route builds on:
// no accessToken -> 401, a valid one -> the verified user, never trusting anything the client asserts.
export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return Response.json({ user })
}
