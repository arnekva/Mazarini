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

    public static readonly currentVersion = '34.3.4'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## Nytt',
                ' * **/vipps boten** – å vippse boten gjorde tidligere ingenting, chipsen forsvant bare inn i et tomrom. Nå er det en faktisk gamble: du kan vinne shards, og sjansen dobler seg for hver 10.000 kr du vippser (f.eks. 5.000 kr har lav sjanse, 10.000 kr gir 50% sjanse for 20 shards). Fra 20.000 kr og oppover er du i tillegg garantert en stigende minimumsgevinst selv om du bommer, så store beløp går aldri helt til spille. (takk, claude - ikkje klag hvis du vippse 100k og får null shards omega',
                '',
                '## Belønninger',
                ' * **Daily Mastermind** – shards deles ikke lenger på antall vinnere, hver vinner får nå fullt shard-beløp. Chips deles fortsatt likt mellom vinnerne.',
                ' * **Daily Mastermind** – premie deles nå ut selv om det bare er én spiller som fullfører dagens mastermind (minimum antall spillere er nå styrt av en variabel, satt til 1).',
                '',
                '## Verifisert',
                ' * **Retarded** – dobbeltsjekket at hvert enkelt kort-treff regner sin egen uavhengige 50/50-sjanse for target-flip, ikke bare ett flip for hele kortet.',
                '## Annet',
                ' * jævla dependabot e skrudd av så null mer spam fra han (yolo)',
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
