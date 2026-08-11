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

    public static readonly currentVersion = '34.5.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## Kortendringer (HP CCG)',
                ' * **Dark Mark** – 0 energi, tilkaller 2 Death Eaters (ingen bounty lenger).',
                ' * **Voldemort** – 6 → 5 skade, Elusive 2 → 1 runde.',
                ' * **Harry Potter** – motstanderens kort koster nå 1 mer (ned fra 2).',
                ' * **Dumbledore** – 1 energi. Deal 6 skade, men blør nå selv i 5 runder.',
                ' * **Hermione** – healing 4 → 3.',
                ' * **Flitwick** – gir 1 energi, +2 hvis spilt med en annen Ravenclaw.',
                ' * **Draco** – tilkaller ikke lenger Death Eater, men beholder bounty.',
                ' * **Remus Lupin** – 2 energi. Deal 2 skade + Bleed på motstander i 2 runder. Beholder 50% sjanse til å bli varulv.',
                ' * **Tonks** – 2 energi. Heal 4 + Recover i 2 runder.',
                ' * **Molly** – speed 50 → 75.',
                ' * **Bertie Bott** – 1 → 0 energi.',
                ' * **Dobby** – Recover i 3 runder.',
                ' * **Ron** – 2 energi. Deal 3 skade, +3 hvis spilt med et annet Gryffindor-kort.',
                ' * **Hagrid** – gjør nå også 3 skade hvis spilt sammen med et magisk vesen.',
                '',
                '## Pranks',
                ' * **Instant Darkness Powder** – motstanderens hånd stokkes inn i bunken; de trekker 4 nye, blanke kort (kun kostnad synlig) neste runde.',
                ' * **Hiccough Sweets** – rammer nå kun motstanderen (kostnader randomiseres 0–4).',
                ' * **Rubber Duck** – rammer nå kun motstanderen.',
                ' * **Malfunction** – fjernet.',
                '',
                '## Annet',
                ' * Alle "summon"-effekter legger nå kortet øverst i bunken i stedet for på hånden.',
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
