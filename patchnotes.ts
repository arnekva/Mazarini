import { CacheType, ChatInputCommandInteraction, TextDisplayBuilder } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { SimpleContainer } from './Abstracts/SimpleContainer'
import { environment } from './client-env'
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

    public static readonly currentVersion = '27.4.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '# End of Season',
                'I stedet for å /rewarde masse ting kommer nå en masse store buffer til diverse spill. Håper det ikke blir alt for broken',
                '* Re-deal av chest skal nå fungere som forventet',
                '\n',
                '# Terning',
                'Streak multiplier 1000 -> 3000',
                'ATH streak multiplier 1500 -> 3000',
                'Biggest loss multiplier 35 -> 70',
                'Same digit multiplier 5 -> 10',
                'all digits 0 except first 5 -> 10',
                'dicetarget hit 10 -> 20',
                'Roll 2 reward 20 -> 100',
                'Double Pot Reward Multiplier 2 -> 3',
                'Loot Box chance 8 -> 20',
                'Special roll reward 5 -> 10',
                'No Thanks 5000 -> 8000',
                'Special numbers: Lagt til 2026',
                '9/11 remove 2977 -> 30.000',
                '9/11 chance 65% -> 80%',
                '\n',
                '# More or Less',
                '1-10: 700 -> 2000',
                '11-20: 500 -> 1250',
                '21-30: 100 -> 600',
                '\n',
                '# Spin',
                '2: 75 -> 200',
                '3: 110 -> 300',
                '4: 250 -> 500',
                '5: 500 -> 650',
                '6: 800 -> 1000',
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
        dbHelper.setBotData('version', PatchNotes.currentVersion)
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
