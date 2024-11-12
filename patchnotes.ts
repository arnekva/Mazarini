import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '18.8.0'
    public static readonly currentPatchNotes =
        `* Lootbox-kommandoen er skrevet om til å støtte midlertidige lootboxes` +
        `* Farge sannsynlighet på trade får seg en liten justering` +
        `  * Fikset en bug som gjorde at det var lavere sannsynlighet for gold enn planlagt` +
        `  * Sannsynligheten for farge på 'trade in' økes fra 1/5, til 1/4` +
        `  * Gjenstandene du trader inn påvirker nå sannsynligheten for farge på både 'trade in' og 'trade up'` +
        `      * Hver silver-gjenstand øker sannsynligheten med 5%` +
        `    * Hver gold-gjenstand øker sannsynligheten med 10%` + 
        `    * Hver diamond-gjenstand øker sannsynligheten med 20%`

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    public static readonly trelloBoardUrl = `https://trello.com/b/g4KkZwaX/bot-h%C3%B8ie`

    constructor(client: MazariniClient) {
        super(client)
    }

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }
    static getNextReleasePatchNotes() {
        return 'Backlog:\n' + PatchNotes.trelloBoardUrl
    }

    static async compareAndSendPatchNotes(msgHelper: MessageHelper, dbHelper: DatabaseHelper) {
        const prev = await dbHelper.getBotData('version')
        if (prev && prev != PatchNotes.currentVersion && environment === 'prod') {
            PatchNotes.publishPatchNotes(msgHelper)
        }
        dbHelper.setBotData('version', PatchNotes.currentVersion)
    }

    static publishPatchNotes(msgHelper: MessageHelper) {
        const patchNotes = PatchNotes.getCurrentPatchNotes()
        msgHelper.sendMessage(ChannelIds.BOT_UTVIKLING, { text: patchNotes })
        msgHelper.sendMessage(ChannelIds.PATCH_NOTES, { text: patchNotes })
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'patchnotes',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getCurrentPatchNotes())
                        },
                    },
                    {
                        commandName: 'backlog',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getNextReleasePatchNotes())
                        },
                    },
                ],
            },
        }
    }
}
