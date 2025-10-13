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

    public static readonly currentVersion = '28.0.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## <:chest_open:1330856644430790709> The Lord of the Loot <:chest_open:1330856644430790709>',
                '   * Ventetiden er over - en ny loot serie har kommet og fører med seg en rekke større endringer.',
                '   * Denne serien består utelukkende av unik loot - her er det ingen farge-varianter.',
                '   * Det lagres omfattende statistikk slik at man ved slutten av en serie nå kan se hva som krevdes for å fullføre den.',
                '### :scroll: Inventory',
                '   * Inventory har blitt skrevet helt om og vil nå være langt raskere. :zap:',
                '   * Alle lootboxer/chests/trades trigger nå automatisk en regenerering i bakgrunnen, av de rarity-ene som faktisk har endret seg.',
                '   * Har lagt til en refresh-knapp med inventory, slik at du slipper å måtte få tilsendt et nytt bilde hver gang.',
                '   * Vi går tilbake til originale farger for rarities! (Grå, Blå, Lilla, Oransje)',
                '## :small_red_triangle_down: Nerfs :small_red_triangle_down:',
                '### Daily',
                '   * Når du når 7 i streak vil streaken din nå nullstilles, heller enn å settes til 1. Påfølgende dag vil da faktisk bli 1 i streak, heller enn 2.',
                '### Deal or no Deal',
                '   * Sjansen for å få effect er nå satt til 0%.',
                '### Deathroll',
                '   * Du får ikke lenger gratis redeal i blackjack dersom du kommer fra deathroll.',
                '   * Halve potten går ikke lenger tilbake ved blackjack tap.',
                '### Wordle',
                '   * Pot er satt ned fra 3000 til 2500.',
                '### Pantelotteriet',
                '   * Fjerner automatisk re-investering av gevinster under 1000 chips i pantelotteriet.',
                '## Misc',
                '   * /spin er ikke lenger ephemeral. Alle vil kunne se resultatet av spinnet ditt (sorry Geggi).',
                '   * Fjerner 1337 spam ved å ikke sjekke på de tidligste sifrene i melding-ID.',
                '   * Database backuper som er eldre enn 4 uker vil nå slettes automatisk.',
                '   * Fikset logging av flere funksjoner',
                '## TLDR :fast_forward:',
                '   * Ny Loot serie! (uten farger)',
                '   * Inventory er rask nå!',
                '   * Masse nerfs - må jobbe litt for looten',
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
