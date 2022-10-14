import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './general/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '10.1.01'
    public static readonly nextVersion = '10.2.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    private static readonly headerNextRelease = 'Endringer som kommer i neste release ' + PatchNotes.nextVersion

    public static readonly currentPatchNotes: string =
        `\n* Nerfet payout fra spin på de laveste verdiene (5-7 minutt) og økt utbetaling for høyere spins (8-10)` +
        `\n* Du kan nå tagge personer i /pullrequest for å rette den mot noen` +
        `\n* Fjernet flere !mz-kommandoer` +
        `\n* /reply viser nå kun svar for den som utførte kommandoen` +
        `\n* /stats rebirth skal nå fungere for å vise stats for kun rebirth`

    public static readonly nextPatchNotes: string =
        `\n* Muligens forbedre preview-en på meldinger slik at varsler på mobil ikke er tomme når Høie svarer på interaksjoner` + `\n* Fikse UwU`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }
    static getNextReleasePatchNotes() {
        return PatchNotes.headerNextRelease + '\n' + PatchNotes.nextPatchNotes
    }

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    public getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'patchnotes',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getCurrentPatchNotes())
                },
                category: 'annet',
            },
            {
                commandName: 'backlog',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getNextReleasePatchNotes())
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
                    this.messageHelper.replyToInteraction(
                        rawInteraction,
                        `Patch notes sendt til ${MentionUtils.mentionChannel(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING)}`,
                        true
                    )
                },
                category: 'annet',
            },
        ]
    }
}
