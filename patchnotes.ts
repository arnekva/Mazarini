import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '18.2.0'
    public static readonly currentPatchNotes = `### Blackjack har fått seg en liten oppussing`
                                             + `\n* Nå får man bare "blackjack" når man får 21 på de første to kortene`
                                             + `\n* En blackjack har betalt ut feil frem til nå, og vil fremover gi (innsats + 1.5x innsats)`
                                             + `\n* De resterende komponentene til blackjack har funnet veien til diverse knapper. Disse inkluderer:`
                                             + `\n  * Split - dersom du får to kort med samme tallverdi kan du velge å splitte disse i to seperate hender. Hendene spilles hver for seg. Dersom du splitter et pas med ess (A), vil du kun få trekke ett ekstra kort per hånd. Du trekkes det samme antallet chips som din opprinnelige innsats. `
                                             + `\n  * Double Down - dersom du får en sum på 9, 10 eller 11 på dine to første kort kan du velge å double down. Du vil da kun få trekke ett ekstra kort. Du trekkes det samme antallet chips som din opprinnelige innsats.`
                                             + `\n  * Insurance - dersom Høie har en ess (A) som sitt åpne kort, kan du velge å kjøpe forsikring mot at han har et kort med tallverdi 10 som sitt skjulte kort. Forsikringen koster halvparten av innsatsen din, og sørger for at du ikke mister chips dersom Høie har en 10-er som sitt skjulte kort.`
                                             + `\n* Høie er dessverre fortsatt rigged som bare faen, men nå har du hvertfall litt flere muligheter til å spille rundt det`
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
