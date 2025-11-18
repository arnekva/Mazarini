import { CacheType, ChatInputCommandInteraction, TextDisplayBuilder } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
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

    public static readonly currentVersion = '28.3.2'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '### Buffs!',
                '* Deathroll',
                '  * Legger til 1989 og 4060 til special numbers',
                '  * Special numbers multiplier økes fra 2.5 til 3',
                '  * Gratis redeal ved hasjwin-blackjack er aktivert igjen',
                '  * Halv tapt hasj returneres igjen',
                '* More or less',
                '  * 1 - 10: 200 => 400',
                '  * 11 - 20: 150 => 300',
                '  * 21 - 30: 100 => 200',
                '  * 31 - 40: 75 => 150',
                '  * 41 - 50: 50 => 100',
                '  * 51+: 25 => 50',
                '* Daily',
                '  * 7-streak: box => chest',
                '* Deal or no deal',
                '  * Effect-offer-odds: 0% => 10%',
                '* Wordle',
                '  * Total reward: 2000 => 5000',
                '  * Maks reward per bruker: 1000 => 2500',
                '### Annet',
                '* Loot inventory art pris: 20.000 => 10.000',
                '* 911 lagt til i "9 (1 - 11)" sjekk og sannsynlighet økt: 50% => 75%',
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
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.messageHelper.replyToInteraction(rawInteraction, '', {}, [PatchNotes.getCurrentPatchNotes().container])
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
