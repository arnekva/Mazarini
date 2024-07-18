import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '17.0.0'
    public static readonly currentPatchNotes = `\n* Rewards på diverse /terning scenarioer samles nå i en felles pott`
                                             + `\n  * Spillere får ikke lenger dette utbetalt direkte`
                                             + `\n  * Spilleren som først triller 69 på et deathroll spill som startet på 10000 eller høyere, claimer hele potten`
                                             + `\n* Jail er skrevet om og fungerer nå som følger:`
                                             + `\n  * /pickpocket er eneste command som sperres`
                                             + `\n  * Den fengslede får kun utbetalt 25% av "gratis" rewards`
                                             + `\n  * Gratis /jailbreak forsøk reduseres til 1`
                                             + `\n  * Kostnaden for en jailbreak bribe reduseres til 5000`
                                             + `\n* Startet refaktorering for sentralisering av chips-styring i en MoneyHelper som kan nås ved client.bank`
                                             + `\n* Alle knapper til /blackjack kan nå kun brukes av den som startet spillet`
                                             + `\n* Lagt til logikk for naturlig blackjack`
                                             + `\n* Bilder i #localhost sjekkes ikke lenger for strekkode`

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
