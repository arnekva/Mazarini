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

    public static readonly currentVersion = '27.4.2'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '# Terning',
                '* Streak multiplier 3000 -> 500',
                '* ATH streak multiplier 3000 -> 1000',
                '* Biggest loss multiplier 70 -> 20',
                '* Same digit multiplier 10 -> 2.5',
                '* all digits 0 except first 10 -> 2.5',
                '* dicetarget hit 20 -> 5',
                '* Roll 2 reward 100 -> 5',
                '* Double Pot Reward Multiplier 3 -> 2',
                '* Loot Box chance 20 -> 8',
                '* Special roll reward 10 -> 2.5',
                '* No Thanks 8000 -> 2500',
                '* 9/11 chance 80% -> 99%',
                '# More or Less',
                '* 1-10: 2000 -> 200',
                '* 11-20: 1250 -> 150',
                '* 21-30: 600 -> 100',
                '* 31-40: 75',
                '* 41-50: 50',
                '* 51+: 25',
                '* Du får nå en chest i stedet for DonD når du fullfører en More or Less. Boksens kvalitet avhengig på lik måte av størrelsen på kategorien.',
                '# Spin',
                '* 2: 200 -> 50',
                '* 3: 300 -> 75',
                '* 4: 500 -> 100',
                '* 5: 650 -> 125',
                '* 6: 1000 -> 300',
                '* 7: 2000 -> 500',
                '* 8: 4000 -> 800',
                '* 9: 7500 -> 1250',
                '* 10: 15000 -> 5000',
                '* 10.59: 30.000 -> 20.000',
                '# Daily',
                '* Base reward 750 -> 500',
                '* Streak reward 4: DonD -> 500',
                '* Streak reward 7: Chest -> Box',
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
