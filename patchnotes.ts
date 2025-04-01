import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '23.1.0'
    public static readonly currentPatchNotes =
        `### Justeringer til more or less` +
        `\n* Ved fullført more or less vil det automatisk sendes dond-knapp` +
        `\n  * 0 - 49 riktige: Basic Deal or no Deal` +
        `\n  * 50 - 99 riktige: Premium Deal or no Deal` +
        `\n  * 100+ riktige: Elite Deal or no Deal` +
        `\n### Justeringer til loot:` +
        `\n* Basic, Premium og Elite chest har nå henholdsvis 20, 50 og 100% sannsynlighet for å ha en effekt` +
        `\n* Lootboxene sannsynlighetene oppdateres for å ta litt mer hensyn til økt antall epic og legendary loot (se detaljerte endringer nederst)` +
        `\n* Det har ikke lenger noe for seg å spare opp trade value for fremtidige effekter da disse ikke lenger går mot trade` +
        `\n### Justeringer til effects:` +
        `\n* De fleste effects får en buff for å gjøre dem litt mer attraktive` +
        `\n* Double loot color chance fjernes` +
        `\n* "Dine neste x antall rewards har garantert farge" legges til (gjelder for lootbox og chest - **ikke** for trade)` +
        `\n### Annet misc` +
        `\n* Fikset en bug som hindret /restart` +
        `\n* Det sjekkes nå (trolig) kun for vinmonopol-åpningstider på ukesbasis` +
        `\n### Lootbox-endringer:` +
        `\n* Basic:` +
        `\n  * Common: 75% -> 62.5%` +
        `\n  * Rare: 15% -> 22.5%` +
        `\n  * Epic: 8% -> 12%` +
        `\n  * Legendary: 2% -> 3%` +
        `\n  * Farge: 20% (uendret)` +
        `\n* Premium:` +
        `\n  * Common: 50% -> 25%` +
        `\n  * Rare: 30% -> 45%` +
        `\n  * Epic: 16% -> 24%` +
        `\n  * Legendary: 4% -> 6%` +
        `\n  * Farge: 33% -> 40%` +
        `\n* Elite:` +
        `\n  * Common: 20% -> 0%` +
        `\n  * Rare: 50% -> 60%` +
        `\n  * Epic: 25% -> 30%` +
        `\n  * Legendary: 5% -> 10%` +
        `\n  * Farge: 90% (uendret)`

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
