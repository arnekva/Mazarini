import { MazariniClient } from '../MazariniClient'

interface IMazariniEvent {
    name: string
}
/** TODO:
 *  Ha en form for random events som trigges på vilkårlige tidspunkt
 *  eksempler; "dobbel gevinst i gambling", "jailtime halveres", "jailbreak for alle", "lottotrekning på X chips", "ekstra NAV-utbetaling"
 *
 */

export class MazariniEvents {
    private client: MazariniClient
    constructor(client: MazariniClient) {
        this.client = client
    }

    get randomEvents() {
        return []
    }
}
