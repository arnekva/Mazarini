"use client"

import { useEffect, useState } from "react"
import { RankTrack } from "@/app/api/spotify/playlist/route"
import { isAdminUser } from "@/lib/admin"
import { RankState, answer, currentCandidate, currentComparison, init, keep, skip } from "@/lib/songRanker"
import { extractPlaylistId } from "@/lib/spotifyIds"
import { clearProgress, loadProgress, saveProgress } from "@/lib/songRankStorage"
import { useDiscord } from "@/providers/discordProvider"
import styles from "./SongRankGame.module.css"

type Screen = "input" | "playing"

export function SongRankGame() {
  const { discordUser } = useDiscord()
  const isAdmin = isAdminUser(discordUser?.id)

  const [screen, setScreen] = useState<Screen>("input")
  const [playlistInput, setPlaylistInput] = useState("")
  const [targetInput, setTargetInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<RankState | null>(null)
  const [saved, setSaved] = useState<RankState | null>(null)
  const [showRanked, setShowRanked] = useState(false)
  const [spotifyUser, setSpotifyUser] = useState<string | null>(null)
  const [addTrackError, setAddTrackError] = useState<string | null>(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  useEffect(() => {
    setSaved(loadProgress())
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetch("/api/spotify/me")
      .then((r) => r.json())
      .then((d) => setSpotifyUser(d.loggedIn ? d.displayName : null))
      .catch(() => {})
  }, [isAdmin])

  function update(next: RankState) {
    setState(next)
    saveProgress(next)
  }

  async function loadPlaylist() {
    if (!playlistInput.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/spotify/playlist?playlist=${encodeURIComponent(playlistInput)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Noe gikk galt")
        return
      }
      const tracks: RankTrack[] = data.tracks
      const targetPlaylistId = targetInput.trim() ? (extractPlaylistId(targetInput) ?? undefined) : undefined
      update(init(playlistInput.trim(), tracks, targetPlaylistId))
      setScreen("playing")
    } catch {
      setError("Klarte ikke å hente spillelisten")
    } finally {
      setLoading(false)
    }
  }

  function resume() {
    if (!saved) return
    setState(saved)
    setScreen("playing")
  }

  function doSkip() {
    if (!state) return
    update(skip(state))
  }

  async function doKeep() {
    if (!state) return
    const track = currentCandidate(state)
    if (track && state.targetPlaylistId) {
      setAddTrackError(null)
      try {
        const res = await fetch("/api/spotify/add-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlistId: state.targetPlaylistId, trackId: track.id }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setAddTrackError(data.error ?? "Klarte ikke å legge til låten i spillelisten")
        }
      } catch {
        setAddTrackError("Klarte ikke å legge til låten i spillelisten")
      }
    }
    update(keep(state))
  }

  function pick(candidateIsBetter: boolean) {
    if (!state) return
    update(answer(state, candidateIsBetter))
  }

  function restart() {
    clearProgress()
    setSaved(null)
    setState(null)
    setScreen("input")
    setPlaylistInput("")
    setTargetInput("")
    setError(null)
  }

  async function logout() {
    await fetch("/api/spotify/logout", { method: "POST" })
    setSpotifyUser(null)
  }

  if (screen === "input") {
    return (
      <div className={styles.intro}>
        {isAdmin && (
          <button className={styles.authLink} type="button" onClick={() => setShowAdminPanel((v) => !v)}>
            Admin {showAdminPanel ? "▲" : "▼"}
          </button>
        )}
        {isAdmin && showAdminPanel && (
          <div className={styles.authRow}>
            {spotifyUser ? (
              <>
                <span className={styles.authStatus}>Logget inn som {spotifyUser}</span>
                <button className={styles.authLink} type="button" onClick={logout}>
                  Logg ut
                </button>
              </>
            ) : (
              <a className={styles.authLink} href="/api/spotify/login">
                Logg inn med Spotify
              </a>
            )}
          </div>
        )}

        <p>Lim inn lenken til en offentlig Spotify-spilleliste. For hver låt velger du hopp over eller behold - beholder du den, plasserer du den med det samme opp mot de du allerede har rangert.</p>
        {saved && (
          <button className={styles.resumeBtn} type="button" onClick={resume}>
            Fortsett forrige rangering ({saved.allTracks.length - saved.queue.length}/{saved.allTracks.length} vurdert, {saved.ranked.length} rangert)
          </button>
        )}
        <input
          className={styles.input}
          placeholder="https://open.spotify.com/playlist/..."
          value={playlistInput}
          onChange={(e) => setPlaylistInput(e.target.value)}
        />
        {isAdmin && spotifyUser && (
          <input
            className={styles.input}
            placeholder="Valgfritt: lenke til en tom spilleliste for godkjente låter"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
          />
        )}
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.startBtn} type="button" disabled={loading || !playlistInput.trim()} onClick={loadPlaylist}>
          {loading ? "Henter..." : "Start ny rangering"}
        </button>
      </div>
    )
  }

  if (!state) return null

  if (state.queue.length === 0) {
    return (
      <>
        <p className={styles.progress}>
          {state.ranked.length} rangert · {state.skippedCount} hoppet over
        </p>
        <div className={styles.resultList}>
          {state.ranked.map((t, i) => (
            <div className={styles.resultRow} key={t.id}>
              <span className={styles.rank}>{i + 1}</span>
              {t.image && <img className={styles.resultImg} src={t.image} alt="" />}
              <div className={styles.resultText}>
                <div className={styles.resultName}>{t.name}</div>
                <div className={styles.resultArtist}>{t.artists}</div>
              </div>
            </div>
          ))}
        </div>
        <button className={styles.restartBtn} type="button" onClick={restart}>
          Rangér en ny spilleliste
        </button>
      </>
    )
  }

  const processed = state.allTracks.length - state.queue.length
  const candidate = state.queue[0]
  const comparison = currentComparison(state)
  const mid = Math.floor((state.lo + state.hi) / 2)

  // The candidate card below is the same element (same key) whether we're still asking
  // skip/keep or already comparing it against ranked songs - keeping it mounted in place
  // stops its Spotify embed from reloading (and losing playback) on that transition. It only
  // actually remounts once `candidate` itself changes to a different track.
  return (
    <>
      <p className={styles.progress}>
        {state.pendingDecision
          ? `Låt ${processed + 1} av ${state.allTracks.length} · ${state.ranked.length} rangert · ${state.skippedCount} hoppet over`
          : `Låt ${processed + 1} av ${state.allTracks.length} · plasserer mellom rangering ${state.lo + 1} og ${state.hi}`}
      </p>
      <div className={styles.vsRow}>
        <TrackCard key={candidate.id} track={candidate} onBetter={state.pendingDecision ? undefined : () => pick(true)} />
        {!state.pendingDecision && comparison && (
          <>
            <div className={styles.vsDivider}>VS</div>
            <TrackCard track={comparison.opponent} onBetter={() => pick(false)} />
          </>
        )}
      </div>
      {state.pendingDecision && (
        <div className={styles.filterRow}>
          <button className={styles.skipBtn} type="button" onClick={doSkip}>
            Hopp over
          </button>
          <button className={styles.keepBtn} type="button" onClick={doKeep}>
            Behold
          </button>
        </div>
      )}
      {addTrackError && <p className={styles.error}>{addTrackError}</p>}
      {state.ranked.length > 0 && (
        <>
          <button className={styles.keptToggle} type="button" onClick={() => setShowRanked((v) => !v)}>
            Vis rangering så langt ({state.ranked.length}) {showRanked ? "▲" : "▼"}
          </button>
          {showRanked && (
            <ul className={styles.keptList}>
              {state.ranked.map((t, i) => (
                <li key={t.id} className={!state.pendingDecision && i === mid ? styles.keptListActive : undefined}>
                  {i + 1}. {t.name}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

function TrackCard({ track, onBetter }: { track: RankTrack; onBetter?: () => void }) {
  return (
    <div className={styles.trackCard}>
      <div className={styles.trackHeader}>
        {track.image && <img className={styles.trackImg} src={track.image} alt="" />}
        <div className={styles.trackText}>
          <div className={styles.trackName}>{track.name}</div>
          <div className={styles.trackArtist}>{track.artists}</div>
        </div>
      </div>
      <iframe
        className={styles.embed}
        src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator`}
        height="80"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
      {onBetter && (
        <button className={styles.betterBtn} type="button" onClick={onBetter}>
          Denne er best
        </button>
      )}
    </div>
  )
}
