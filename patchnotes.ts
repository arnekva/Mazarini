import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '22.0.0'
    public static readonly currentPatchNotes =
        `## <:chest_closed:1330857037021581383> Star Wars loot series! <:chest_closed:1330857037021581383>` +
        `\n### Det er kanskje ikke 4. mai enda, men folk begynner å gå tom for loot å samle på, så da kan dere endelig bryne dere på en helt ny serie med masse godsaker` +
        `\n* Hvis du er lei av SF-kino kan du glede deg over at en ny serie betyr en ny stil` +
        `\n* I motsetning til Mazarini-serien, byr denne serien på et fullt brett i alle rarities` +
        `\n* Alle loot-relaterte kommandoer og premier går automatisk mot den nyeste serien` +
        `\n  * De fleste kommandoer har et valgfritt option for 'series' dersom du ønsker å gå mot Mazarini-serien` +
        `\n  * Minner også om at du i input for loot trade kan søke på både 'serie', 'rarity', 'farge' og 'navn'` +
        `\n## Diverse nytt` +
        `\n* Loot chests har nå en 10% sannsynlighet for å også gi deg valget om en effect :tickets:` +
        `\n  * Majoriteten av disse effektene ble dere kjent med under julekalenderen` +
        `\n  * NB: Effekter som ikke starter med et tall, er kun gyldige frem til førstkommende daily jobs (som kjøres kl 05 hver morgen) :hourglass:` +
        `\n* I /brukerinnstillinger kan du nå sette at du kun ønsker å se duplikater når du trader :mag:` +
        `\n  * Antallene du da ser på trade-forslagene er antallet duplikater` +
        `\n  * Du er safet mot å uheldigvis trade vekk noe du bare har én av` +
        `\n  * Du slipper å lete så lenge etter valgene du ser etter`

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
