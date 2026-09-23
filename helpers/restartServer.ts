import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import { MazariniClient } from '../client/MazariniClient'

/**
 * Tiny localhost-only HTTP server for an external deployer (e.g. Watchtower's pre-update hook).
 *
 *   GET /restart-check -> runs the save/refund step for every command class, then 200 { safe: true }
 *   GET /health        -> 200 { status: 'ok' }  basic liveness (Docker healthchecks)
 *
 * It never blocks a deploy: games are saved or refunded as part of the save step, so a restart is
 * always fine. The endpoint only exists so the save runs *before* the old container is replaced.
 *
 * Bound to 127.0.0.1 only, so it is never reachable from outside the container/host.
 */
export class RestartServer {
    /** Whether we've already logged the "swapping" message for the current deploy attempt */
    private swapLogged = false

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
                await this.client.onRestart(true)
                if (!this.swapLogged) {
                    this.client.messageHelper.sendLogMessage('🔄 Starter swap til ny build nå')
                    this.swapLogged = true
                }
                return this.send(res, 200, { safe: true })
            } catch (err) {
                this.client.messageHelper.sendLogMessage(`⚠️ Lagring før restart feilet: ${err}`)
                return this.send(res, 500, { safe: false, error: `${err}` })
            }
        }

        return this.send(res, 404, { error: 'not found' })
    }

    private send(res: ServerResponse, status: number, body: unknown): void {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
    }
}
