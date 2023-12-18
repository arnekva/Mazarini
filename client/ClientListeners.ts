import { ClientEvents } from 'discord.js'

/** NOT IN USE
 *  Testing sub-properties and functions
 */
export class ClientListeners {
    listeners = {
        on: () => {
            return <K extends keyof ClientEvents>(action: K, clb: () => void) => {
                true
            }
        },
        test: () => {
            return false
        },
    }
}
