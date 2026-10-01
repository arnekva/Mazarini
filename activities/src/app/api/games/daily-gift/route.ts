import { giftIcon, giftLabel, grantGift, GIFT_PATH, readDailyGift } from "@/lib/dailyGift"
import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"

/** The caller's gift, if there is one for them: the options to pick from, or what they already picked this round. */
export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const gift = await readDailyGift(new FirebaseHelper())
  if (!gift || !gift.recipients.includes(user.id)) return Response.json({ eligible: false })

  const options = gift.options.map((o) => ({ id: o.id, kind: o.kind, label: giftLabel(o), icon: giftIcon(o) }))
  const claim = gift.claims?.[user.id]
  return Response.json({ eligible: true, options, claimedOptionId: claim?.optionId ?? null })
}

/** `{ optionId }` - picks one of this round's gifts. Only the first pick of a round counts. */
export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { optionId } = await request.json().catch(() => ({}))
  const firebase = new FirebaseHelper()
  const gift = await readDailyGift(firebase)
  if (!gift || !gift.recipients.includes(user.id)) return Response.json({ error: "Du har ingen gave å hente" }, { status: 400 })

  const option = gift.options.find((o) => o.id === optionId)
  if (!option) return Response.json({ error: "Den gaven finnes ikke" }, { status: 400 })

  // Atomic: of two picks landing together (a double-click, two devices), exactly one goes through.
  const claimed = await firebase.claim(`${GIFT_PATH}/claims/${user.id}`, { optionId: option.id, at: Date.now() })
  if (!claimed) return Response.json({ error: "Du har allerede hentet dagens gave", alreadyClaimed: true }, { status: 409 })

  await firebase.updateUserFields(user.id, { claimedGift: gift.roundId })
  await grantGift(firebase, user, option)
  return Response.json({ claimed: true, optionId: option.id, label: giftLabel(option) })
}
