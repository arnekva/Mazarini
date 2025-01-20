import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '19.5.0'
    public static readonly currentPatchNotes = `## Introduserer Loot Chests!`
                                             + `\n Du får nå en ny vei til målet om å samle alle loot items`
                                             + `\n * Loot chests finnes for alle lootbox-kvaliteter`
                                             + `\n * Når du kjøper en chest, får du valget mellom 3 forskjellige loot items som du kan åpne og beholde`
                                             + `\n * Du får vite hvilken sjeldenhetsgrad og eventuell farge som skjuler seg bak hver knapp, men den endelige avsløringen av nøyaktig hvilket item du får lar vente på seg til du har tatt ditt valg`
                                             + `\n * Loot chests vil alltid koste det dobbelte av en enkelt lootbox av samme kvalitet`
                                             + `\n * Du sitter bare igjen med ett item fra en chest, men dersom du jakter et spesifikt item, kan dette kutte ned tiden på jakten ved å filtrere gjennom flere items om gangen`
                                             + `\n * Premium lootbox som daily streak no.7 reward byttes ut med en basic loot chest`

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
