import { ClientEvents } from 'discord.js'

/** NOT IN USE */
export class ClientListeners {
    listeners = {
        on: () => {
            return <K extends keyof ClientEvents>(action: K, clb: () => void) => {
                true
            }
        },
    }
}
