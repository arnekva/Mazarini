"use client"

import { callApi } from "@/lib/apiClient"
import { useEffect, useState } from "react"
import styles from "./AdminPanel.module.css"

type Quality = "basic" | "premium" | "elite"
type Tiered = "dond" | "box" | "chest"

interface GiftOption {
  id: string
  kind: Tiered | "chips" | "spin" | "pot"
  quality?: Quality
  amount?: number
}

interface CurrentGift {
  roundId: string
  options: GiftOption[]
  recipients: string[]
  createdAt: number
  claims: { userId: string; optionId: string; label: string; at: number }[]
}

const QUALITIES: Quality[] = ["basic", "premium", "elite"]
const TIERED: { kind: Tiered; title: string; icon: string; names: Record<Quality, string> }[] = [
  { kind: "dond", title: "Deal or No Deal", icon: "💼", names: { basic: "10k", premium: "20k", elite: "50k" } },
  { kind: "box", title: "Lootbox", icon: "📦", names: { basic: "Basic", premium: "Premium", elite: "Elite" } },
  { kind: "chest", title: "Loot chest", icon: "🎁", names: { basic: "Basic", premium: "Premium", elite: "Elite" } },
]

const tierKey = (kind: Tiered, quality: Quality) => `${kind}-${quality}`

function optionText(o: GiftOption): string {
  const tier = TIERED.find((t) => t.kind === o.kind)
  if (tier && o.quality) return `${tier.icon} ${tier.title} ${tier.names[o.quality]}`
  if (o.kind === "chips") return `🪙 ${(o.amount ?? 0).toLocaleString("nb-NO")} chips`
  if (o.kind === "pot") return `💀 Legg til ${(o.amount ?? 0).toLocaleString("nb-NO")} i deathroll-potten`
  return "🎡 Ekstra spinn"
}

export function AdminDailyGift({ accessToken, myId }: { accessToken: string; myId?: string }) {
  const [current, setCurrent] = useState<CurrentGift | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [tiers, setTiers] = useState<Set<string>>(new Set())
  const [chipsOn, setChipsOn] = useState(false)
  const [chips, setChips] = useState("")
  const [potOn, setPotOn] = useState(false)
  const [pot, setPot] = useState("")
  const [spin, setSpin] = useState(false)
  const [recipients, setRecipients] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  // Publishing over a round people have already picked from starts a fresh one - asked twice rather than through confirm(),
  // which Discord's Activity frame doesn't allow.
  const [confirmingReplace, setConfirmingReplace] = useState(false)

  async function load() {
    const res = await callApi<{ gift: CurrentGift | null; defaultRecipients: string[] }>("/api/admin/daily-gift", accessToken)
    setCurrent(res.gift)
    // The form starts from what's live, so a tweak doesn't mean ticking everything again.
    const options = res.gift?.options ?? []
    setTiers(new Set(options.filter((o) => o.quality).map((o) => tierKey(o.kind as Tiered, o.quality!))))
    const chipsOption = options.find((o) => o.kind === "chips")
    setChipsOn(!!chipsOption)
    setChips(chipsOption?.amount ? String(chipsOption.amount) : "")
    const potOption = options.find((o) => o.kind === "pot")
    setPotOn(!!potOption)
    setPot(potOption?.amount ? String(potOption.amount) : "")
    setSpin(options.some((o) => o.kind === "spin"))
    setRecipients((res.gift?.recipients ?? res.defaultRecipients).join("\n"))
    setLoaded(true)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the panel's data once on open
    load().catch(() => setMessage({ text: "Klarte ikke å laste gaven", ok: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  function toggleTier(key: string) {
    setTiers((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const chipsAmount = Math.floor(Number(chips))
  const potAmount = Math.floor(Number(pot))
  const options: GiftOption[] = [
    ...TIERED.flatMap((t) => QUALITIES.filter((q) => tiers.has(tierKey(t.kind, q))).map((q) => ({ id: tierKey(t.kind, q), kind: t.kind, quality: q }))),
    ...(chipsOn && chipsAmount > 0 ? [{ id: "chips", kind: "chips" as const, amount: chipsAmount }] : []),
    ...(potOn && potAmount > 0 ? [{ id: "pot", kind: "pot" as const, amount: potAmount }] : []),
    ...(spin ? [{ id: "spin", kind: "spin" as const }] : []),
  ]
  const recipientIds = recipients.split(/[\s,]+/).filter(Boolean)
  const claimCount = current?.claims.length ?? 0

  async function publish() {
    if (claimCount > 0 && !confirmingReplace) {
      setConfirmingReplace(true)
      return
    }
    setConfirmingReplace(false)
    setBusy(true)
    setMessage(null)
    try {
      await callApi("/api/admin/daily-gift", accessToken, {
        method: "POST",
        body: JSON.stringify({ action: "publish", options, recipients: recipientIds }),
      })
      setMessage({ text: "Gaven er publisert - mottakerne kan velge den på Daily claim nå.", ok: true })
      await load()
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Klarte ikke å publisere", ok: false })
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    try {
      await callApi("/api/admin/daily-gift", accessToken, { method: "POST", body: JSON.stringify({ action: "clear" }) })
      setMessage({ text: "Gaven er fjernet.", ok: true })
      await load()
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Klarte ikke å fjerne gaven", ok: false })
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <p className={styles.muted}>Laster...</p>

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>🎁 Daglig gave</h2>
        <p className={styles.muted}>Mottakerne velger én av gavene du huker av, fra Daily claim-siden. Hver publisering er en ny runde.</p>
      </div>

      {TIERED.map((t) => (
        <div key={t.kind} className={styles.group}>
          <span className={styles.groupTitle}>
            {t.icon} {t.title}
          </span>
          <div className={styles.pills}>
            {QUALITIES.map((q) => {
              const key = tierKey(t.kind, q)
              return (
                <button key={q} type="button" className={`${styles.pill} ${tiers.has(key) ? styles.pillOn : ""}`} aria-pressed={tiers.has(key)} onClick={() => toggleTier(key)}>
                  {t.names[q]}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className={styles.group}>
        <span className={styles.groupTitle}>🪙 Chips</span>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${chipsOn ? styles.pillOn : ""}`} aria-pressed={chipsOn} onClick={() => setChipsOn((on) => !on)}>
            {chipsOn ? "På" : "Av"}
          </button>
          <input
            className={styles.input}
            type="number"
            min={1}
            step={1000}
            placeholder="Antall chips"
            value={chips}
            onChange={(e) => {
              setChips(e.target.value)
              setChipsOn(e.target.value !== "")
            }}
            aria-label="Antall chips"
          />
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>💀 Deathroll-pott</span>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${potOn ? styles.pillOn : ""}`} aria-pressed={potOn} onClick={() => setPotOn((on) => !on)}>
            {potOn ? "På" : "Av"}
          </button>
          <input
            className={styles.input}
            type="number"
            min={1}
            step={1000}
            placeholder="Legg til i potten"
            value={pot}
            onChange={(e) => {
              setPot(e.target.value)
              setPotOn(e.target.value !== "")
            }}
            aria-label="Chips å legge i deathroll-potten"
          />
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>🎡 Lykkehjul</span>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${spin ? styles.pillOn : ""}`} aria-pressed={spin} onClick={() => setSpin((on) => !on)}>
            Ekstra spinn
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>👥 Mottakere ({recipientIds.length})</span>
        <textarea className={styles.textarea} rows={5} value={recipients} onChange={(e) => setRecipients(e.target.value)} aria-label="Discord-ID-er, én per linje" />
      </div>

      <div className={styles.preview}>
        <span className={styles.groupTitle}>De kan velge mellom</span>
        {options.length === 0 ? (
          <p className={styles.muted}>Ingen gaver valgt ennå.</p>
        ) : (
          <ul className={styles.previewList}>
            {options.map((o) => (
              <li key={o.id}>{optionText(o)}</li>
            ))}
          </ul>
        )}
      </div>

      {message && <p className={message.ok ? styles.ok : styles.error}>{message.text}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} disabled={busy || options.length === 0 || recipientIds.length === 0} onClick={publish}>
          {confirmingReplace ? `${claimCount} har hentet - publiser ny runde likevel?` : current ? "Publiser ny runde" : "Publiser gave"}
        </button>
        {current && (
          <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={clear}>
            Fjern gave
          </button>
        )}
      </div>

      {current && (
        <div className={styles.status}>
          <span className={styles.groupTitle}>Nåværende runde · publisert {new Date(current.createdAt).toLocaleString("nb-NO")}</span>
          <ul className={styles.claimList}>
            {current.recipients.map((id) => {
              const claim = current.claims.find((c) => c.userId === id)
              return (
                <li key={id} className={claim ? styles.claimed : ""}>
                  <code>{id}</code>
                  {id === myId ? " (deg)" : ""}
                  <span>{claim ? `✅ ${claim.label}` : "⏳ Ikke hentet"}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
