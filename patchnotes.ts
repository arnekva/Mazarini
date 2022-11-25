import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './general/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '10.6.1'
    public static readonly nextVersion = 'Backlog'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    private static readonly headerNextRelease = 'Saker i ' + PatchNotes.nextVersion

    public static readonly currentPatchNotes: string =
        `\n* /vinmonopolet inkluderer nå hvor lenge det er til stengetid` +
        `\n* Lagt til en melding som forklarer at du ikke kan redigere en gammel melding for å trigge en slash command (man kunne redigere en melding for å trigge en !mz command før)` +
        `\n* Botten sjekker nå om den har tilgang til en channel før sendMessage sender melding (fikser feil med /reply og /send)` +
        `\n* Oppdatert /drop for Al Mazrah på Warzone` +
        `\n* Fikset at Høie ikke svarte med 'lol' når ${MentionUtils.mentionUser('733320780707790898')} tagget Jævla Drittspel` +
        `\n* Fjernet rebirth island og fortunes keep fra /drop og /grid` +
        `\n* Fikset UwU` +
        `\n* Fikset redigering/pinning av en //TODO:` +
        `\n* Økt multiplier for daily prestige`

    public static readonly nextPatchNotes: string = `https://trello.com/b/g4KkZwaX/bot-h%C3%B8ie`

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
