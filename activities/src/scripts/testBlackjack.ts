// Throwaway script to exercise the real blackjack handler functions end-to-end against the dev
// Firebase node, to catch the actual crash instead of guessing. Delete after debugging.
import fs from "node:fs"
import path from "node:path"

const envPath = path.join(__dirname, "..", "..", ".env.local")
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

async function main() {
  const { dealBlackjackRound, getBlackjackStatus, hitBlackjack, joinBlackjackTable, standBlackjack } = await import("../lib/blackjackHandler")

  const instanceId = `test-${Date.now()}`
  const p1 = { id: "111", username: "P1", globalName: "P1" }
  const p2 = { id: "222", username: "P2", globalName: "P2" }

  async function dump(label: string, res: Response) {
    const body = await res.json()
    console.log(`--- ${label} (status ${res.status}) ---`)
    console.log(JSON.stringify(body, null, 2))
    return body
  }

  await dump("join p1", await joinBlackjackTable(instanceId, p1))
  await dump("join p2", await joinBlackjackTable(instanceId, p2))
  await dump("status after joins", await getBlackjackStatus(instanceId))
  await dump("deal", await dealBlackjackRound(instanceId, p1))
  await dump("status after deal", await getBlackjackStatus(instanceId))

  for (let i = 0; i < 10; i++) {
    const status = await getBlackjackStatus(instanceId)
    const view: any = await status.json()
    if (view.status !== "playing") {
      console.log("round finished, status:", view.status)
      break
    }
    for (const player of [p1, p2]) {
      const pv = view.players.find((p: any) => p.id === player.id)
      if (pv?.status !== "playing") continue
      const action = Math.random() < 0.5 ? "hit" : "stand"
      const fn = action === "hit" ? hitBlackjack : standBlackjack
      const res = await fn(instanceId, player)
      await dump(`${player.username} ${action}`, res)
    }
  }

  const final = await dump("final status", await getBlackjackStatus(instanceId))
  console.log("DONE, final table status:", final.status)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SCRIPT CRASHED:", err)
    process.exit(1)
  })
