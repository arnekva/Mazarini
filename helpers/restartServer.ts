import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import { MazariniClient } from '../client/MazariniClient'
import { MentionUtils } from '../utils/mentionUtils'

/**
 * Tiny localhost-only HTTP server that lets an external deployer (e.g. Watchtower's pre-update hook)
 * ask the bot whether it is currently safe to restart. It reuses the exact same impediment check as
 * the /restart command, so active games block an automated deploy just like they block a manual one.
 *
 *   GET /restart-check -> 200 { safe: true }                       when nothing is in progress
 *                         423 { safe: false, impediments: [...] }  when a game/etc. is active
 *   GET /health        -> 200 { status: 'ok' }                     basic liveness (Docker healthchecks)
 *
 * Bound to 127.0.0.1 only, so it is never reachable from outside the container/host.
 *
 * Each check is mirrored to the Discord log channel so a deploy can be followed live, but the
 * "waiting" message is throttled so a long-running game doesn't flood the channel every poll.
 */
export class RestartServer {
    private static readonly IMPEDED_LOG_THROTTLE_MS = 5 * 60 * 1000
    /** How long the same impediment set may block a deploy before it's treated as stagnant and overridden */
    private static readonly STAGNANT_OVERRIDE_MS = Number(process.env.STAGNANT_OVERRIDE_MINUTES ?? 10) * 60 * 1000

    /** Last impediment set we logged, joined to a string — used to detect changes and avoid repeats */
    private lastImpedimentsKey = ''
    /** When we last logged an "impeded" message, for throttling identical repeats */
    private lastImpededLogAt = 0
    /** Whether we've already logged the "swapping" message for the current safe window */
    private swapLogged = false
    /** When the current uninterrupted blocking streak began (0 = not currently blocked) */
    private blockingSince = 0
    /** Impediments seen during the current blocking streak — a genuinely new one resets the stagnation timer */
    private readonly seenImpediments = new Set<string>()

    constructor(private readonly client: MazariniClient) {}

    start(): Server {
        const port = Number(process.env.RESTART_CHECK_PORT ?? 8475)

        const server = createServer((req, res) => {
            void this.handle(req, res)
        })

        // A port conflict (e.g. a second local instance) must never crash the bot
        server.on('error', (err: NodeJS.ErrnoException) => {
            this.client.messageHelper.sendLogMessage(`Restart-check server kunne ikke starte: ${err.message}`)
        })

        server.listen(port, '127.0.0.1', () => {
            console.log(`Restart-check server listening on 127.0.0.1:${port}`)
        })

        return server
    }

    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (req.method !== 'GET') return this.send(res, 405, { error: 'method not allowed' })

        if (req.url === '/health') return this.send(res, 200, { status: 'ok' })

        if (req.url === '/restart-check') {
            try {
                const impediments = await this.client.collectRestartImpediments(true)
                if (impediments.length > 0) {
                    const now = Date.now()
                    // A genuinely new impediment (fresh activity) resets the stagnation timer; the same
                    // set persisting does not. This way an actively-played channel is never interrupted,
                    // but a stuck/abandoned game can't block the deploy forever.
                    const hasNew = impediments.some((i) => !this.seenImpediments.has(i))
                    if (this.blockingSince === 0 || hasNew) this.blockingSince = now
                    impediments.forEach((i) => this.seenImpediments.add(i))

                    if (now - this.blockingSince >= RestartServer.STAGNANT_OVERRIDE_MS) {
                        this.logStagnantOverride(impediments, now - this.blockingSince)
                        this.resetBlocking()
                        return this.send(res, 200, { safe: true, overridden: true })
                    }
                    this.logImpeded(impediments)
                    return this.send(res, 423, { safe: false, impediments })
                }
                this.resetBlocking()
                this.logSwapping()
                return this.send(res, 200, { safe: true })
            } catch (err) {
                this.client.messageHelper.sendLogMessage(`⚠️ Restart-sjekk feilet: ${err}`)
                return this.send(res, 500, { safe: false, error: `${err}` })
            }
        }

        return this.send(res, 404, { error: 'not found' })
    }

    /** Log that a deploy is waiting — but only when the reasons change or the throttle window elapses */
    private logImpeded(impediments: string[]): void {
        this.swapLogged = false
        const key = impediments.join(' | ')
        const now = Date.now()
        const changed = key !== this.lastImpedimentsKey
        if (changed || now - this.lastImpededLogAt > RestartServer.IMPEDED_LOG_THROTTLE_MS) {
            const reasons = impediments.map((i) => `• ${i}`).join('\n')
            const developer = MentionUtils.mentionRole(MentionUtils.ROLE_IDs.DEVELOPER)
            this.client.messageHelper.sendLogMessage(
                `${developer} ⏳ Deploy utsatt – venter på at følgende skal bli ferdig:\n${reasons}\nKan tvinges gjennom med /restart.`
            )
            this.lastImpedimentsKey = key
            this.lastImpededLogAt = now
        }
    }

    /** Clear the stagnation-tracking state (impediments gone, or a stagnant set was just overridden) */
    private resetBlocking(): void {
        this.blockingSince = 0
        this.seenImpediments.clear()
    }

    /** Log that a stuck impediment set was forced through after the stagnation timeout */
    private logStagnantOverride(impediments: string[], waitedMs: number): void {
        const mins = Math.round(waitedMs / 60000)
        const reasons = impediments.map((i) => `• ${i}`).join('\n')
        this.client.messageHelper.sendLogMessage(
            `⚠️ Deploy tvunget gjennom etter ${mins} min – ignorerer fastlåste hindringer og bytter til ny build:\n${reasons}`
        )
    }

    /** Log that the gate is clear and the new build is about to be swapped in — once per safe window */
    private logSwapping(): void {
        this.lastImpedimentsKey = ''
        if (!this.swapLogged) {
            this.client.messageHelper.sendLogMessage('🔄 Starter swap til ny build nå')
            this.swapLogged = true
        }
    }

    private send(res: ServerResponse, status: number, body: unknown): void {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
    }
}
