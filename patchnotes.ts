import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
import { UserUtils } from './utils/userUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.7.2'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Verdenskrig pinger nå ${MessageUtils.getRoleTagString(
            UserUtils.ROLE_IDs.NATO
        )} når en krig starter og når resultatene er klare. Assign deg selv rollen hvis du vil.` +
        `\n* Verdenskrig skal nå vise balansen til alle deltakere ved slutten` +
        `\n* Lagt til nye hjelpemetoder i MessageUtils og UserUtils for å finne og tagge roller` +
        `\n* Det logges nå en feilmelding hvis en admin setter bottens status til streaming uten å sette url.` +
        `\n* Ny adminfunksjon <downtime> som sender en melding til #bot-utvikling som varsler om downtime` +
        `\n* Brukeren som starten krigen (eller andre kommandoer som krever en tommel opp reaksjon) kan nå stoppe den med å reagere med tommel ned. Superadminer kan også stoppe disse`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'patch',
                description: 'Vis nyligste patch notes',
                command: (rawMessage: Message, messageContent: string) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(rawMessage.channelId, pn)
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                description: 'Vis nyligste patch notes',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
                },
                category: 'admin',
            },
        ]
    }
}
