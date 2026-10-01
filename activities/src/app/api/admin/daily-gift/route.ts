import { isAdminUser } from "@/lib/admin"
import { DEFAULT_GIFT_RECIPIENTS, GIFT_PATH, giftLabel, parseGiftOptions, parseRecipients, readDailyGift } from "@/lib/dailyGift"
import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"

/** Admin only, checked here on the server - the panel being hidden in the UI is not what keeps anyone else out. */
async function authenticateAdmin(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return { error }
  if (!isAdminUser(user.id)) return { error: Response.json({ error: "Bare for admin" }, { status: 403 }) }
  return { user }
}

/** The current round, with every claim spelled out - or the defaults to start a first one from. */
export async function GET(request: Request) {
  const { error } = await authenticateAdmin(request)
  if (error) return error

  const gift = await readDailyGift(new FirebaseHelper())
  if (!gift) return Response.json({ gift: null, defaultRecipients: DEFAULT_GIFT_RECIPIENTS })

  const claims = Object.entries(gift.claims ?? {}).map(([userId, claim]) => {
    const option = gift.options.find((o) => o.id === claim.optionId)
    return { userId, optionId: claim.optionId, label: option ? giftLabel(option) : claim.optionId, at: claim.at }
  })
  return Response.json({ gift: { ...gift, claims }, defaultRecipients: DEFAULT_GIFT_RECIPIENTS })
}

/** `{ action: "publish", options, recipients }` starts a new round (everyone can pick again); `{ action: "clear" }` takes the gift down. */
export async function POST(request: Request) {
  const { error } = await authenticateAdmin(request)
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const firebase = new FirebaseHelper()

  if (body.action === "clear") {
    await firebase.updateData({ [GIFT_PATH]: null })
    return Response.json({ ok: true })
  }
  if (body.action !== "publish") return Response.json({ error: "Ukjent handling" }, { status: 400 })

  const options = parseGiftOptions(body.options)
  if (typeof options === "string") return Response.json({ error: options }, { status: 400 })
  const recipients = parseRecipients(body.recipients)
  if (typeof recipients === "string") return Response.json({ error: recipients }, { status: 400 })

  // Replaces the whole thing, claims included - a new round, so a fresh pick for everyone.
  const now = Date.now()
  await firebase.updateData({ [GIFT_PATH]: { roundId: String(now), options, recipients, createdAt: now } })
  return Response.json({ ok: true, roundId: String(now) })
}
