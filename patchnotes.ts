import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '26.0.0'
    public static readonly currentPatchNotes =
        `## Da var vi kommet til D-Day sitt 81-års jubileum, og finnes det en bedre måte å markere det på enn en ny loot serie? <:geggiexcited:1009385627604754452>` +
        `\n### Og hvilket tema er vel da mer passende enn Harry Potter?? <:geggiexcited:1009385627604754452><:geggiexcited:1009385627604754452>` +
        `\n* Denne serien kommer med et par visuelle endringer fra tidligere serier` +
        `\n  * Ny serie betyr ny tematisk intro` +
        `\n  * Nameplates er vekke - nå er det kun karakterene selv som indikerer farge` +
        `\n  * Et emblem nede til høyre viser hvilken rarity karakteren er` +
        `\n  * Hvis du tar en kikk på /inventory vil du se at seriens rarity-farger har fått seg en tematisk oppdatering` +
        `\n### Annet nytt` +
        `\n* Blackjack får seg en nerf` +
        `\n  * Du får ikke lengre noen gratis dpn fra deathroll` +
        `\n  * Dersom hasjen tapes, er den vekke. Halvparten av tapet vil ikke lenger tilbakeføres` +
        `\n* Spin får seg en liten nerf` +
        `\n* Enkelte effects får seg en liten nerf` +
        `\n* Chips resettes til 0` +
        `\n* Daily resettes til "not claimed today" og alle starter med en streak på 6` +
        `\n* Effects resettes til default verdier` +
        `\n* OBS: Hvis du ikke får spilt av nye reveal gifs på tlf må du nok oppdatere discord-appen` +
        `\n###TLDR` +
        `\n* Ny loot series - yay!` +
        `\n* Mange av tingene dine resettes` +
        `\n* Oppdater discord kanskje`

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
