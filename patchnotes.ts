import { TextDisplayBuilder } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ChatInteraction } from './Abstracts/MazariniInteraction'
import { SimpleContainer } from './Abstracts/SimpleContainer'
import { database, environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly trelloBoardUrl = `https://trello.com/b/g4KkZwaX/bot-h%C3%B8ie`

    constructor(client: MazariniClient) {
        super(client)
    }

    public static readonly currentVersion = '30.5.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## CCG',
                '* Reduserer delay-en mellom game messages',
                '  * Spilte kort: 3s -> 2.5s',
                '  * Status-ticks: 3s -> 2s',
                '* Fikser en bug hvor reflected damage kunne bli stoppet av en ny accuracy sjekk',
                '* Høie vil ikke lenger spille heal kort når han har full HP',
                '### Trade in',
                '* Du kan nå trade in ccg kort! (`/deck trade`)',
                '* Du mottar ikke nye kort direkte, men får shards som kan brukes til å skaffe nye kort',
                '* Trade-verdier:',
                '  * Common: 5',
                '  * Rare: 10',
                '  * Epic: 15',
                '  * Legendary: 25',
                '* Default-kortene du startet med kan ikke trades inn, men eventuelle ekstra av de samme kortene kan trades',
                '### Buffs / Nerfs',
                '* Chokester',
                '  * Cost: 2 -> 3',
                '  * Mottatt mange klager her',
                '* KEKW Gun',
                '  * Cost: 3 -> 2',
                '  * Oppdatert kort-tekst',
                '  * Mottatt mange klager her',
                '* Pointerbrother',
                '  * Cost: 3 -> 1',
                '  * Make <:pointerbrothers1:1177653110852825158> epic again',
            ].join('\n')
        )
        container.addSeparator()
        container.addComponent(text, 'currentPatchNotes')

        return container
    }
    static getNextReleasePatchNotes() {
        return 'Backlog:\n' + PatchNotes.trelloBoardUrl
    }

    static async compareAndSendPatchNotes(msgHelper: MessageHelper, dbHelper: DatabaseHelper) {
        const prev = await dbHelper.getBotData('version')
        if (prev && prev != PatchNotes.currentVersion && environment === 'prod') {
            PatchNotes.publishPatchNotes(msgHelper)
        }
        if (environment === database) {
            dbHelper.setBotData('version', PatchNotes.currentVersion)
        }
    }

    static publishPatchNotes(msgHelper: MessageHelper) {
        const patchNotes = PatchNotes.getCurrentPatchNotes()
        msgHelper.sendMessage(ChannelIds.BOT_UTVIKLING, { components: [patchNotes.container] }, { isComponentOnly: true })
        msgHelper.sendMessage(ChannelIds.PATCH_NOTES, { components: [patchNotes.container] }, { isComponentOnly: true })
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'patchnotes',
                        command: (rawInteraction: ChatInteraction) => {
                            this.messageHelper.replyToInteraction(rawInteraction, '', {}, [PatchNotes.getCurrentPatchNotes().container])
                        },
                    },
                    {
                        commandName: 'backlog',
                        command: (rawInteraction: ChatInteraction) => {
                            this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getNextReleasePatchNotes())
                        },
                    },
                ],
            },
        }
    }
}
