import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BaseInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'

import { IInteractionElement } from '../../interfaces/interactionInterface'
import { PoletCommands } from '../drinks/poletCommands'

export class LinkCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async handleLinking(interaction: ChatInteraction) {
        await interaction.deferReply()

        const isWZ = interaction.options.getSubcommand() === 'warzone'
        const isRocket = interaction.options.getSubcommand() === 'rocket'
        const isLastFM = interaction.options.getSubcommand() === 'lastfm'
        const isVinmonopol = interaction.options.getSubcommand() === 'vinmonopol'
        const isVivino = interaction.options.getSubcommand() === 'vivino'

        let saved = false
        let msg = ''
        if (isWZ) {
            const platform = interaction.options.get('plattform')?.value as string
            const username = interaction.options.get('brukernavn')?.value as string
            msg = `Linket *${username}* *${platform}* til brukeren din for Warzone`

            saved = await this.linkWZName(interaction, platform, username)
        } else if (isRocket) {
            const platform = interaction.options.get('plattform')?.value as string
            const username = interaction.options.get('brukernavn')?.value as string
            saved = await this.linkRocketName(interaction, platform, username)
            msg = `Linket *${username}* *${platform}* til brukeren din for Rocket League`
        } else if (isLastFM) {
            const username = interaction.options.get('brukernavn')?.value as string
            saved = await this.linkLastFMName(interaction, username)
            msg = `Linket *${username}* til brukeren din for Last.fm`
        } else if (isVinmonopol) {
            const polID = interaction.options.get('vinmonopolid')?.value as string
            const data = await this.linkVinmonopolToUser(polID, interaction.user.id)
            saved = !!data
            msg = `Vinmonopolet ${data} er lagret på brukeren din`
        } else if (isVivino) {
            const vivinoId = interaction.options.get('userid')?.value as string
            const data = await this.linkVivinoId(interaction, vivinoId)
            saved = !!data
            msg = `Vivino id er lagret på brukeren din`
        }

        if (saved) this.messageHelper.replyToInteraction(interaction, msg, { hasBeenDefered: true })
        else this.messageHelper.replyToInteraction(interaction, 'Klarte ikke hente brukernavn eller plattform', { hasBeenDefered: true })
    }

    private async linkWZName(rawInteraction: ChatInteraction, platform?: string, username?: string): Promise<boolean> {
        if (!platform || !username) return false
        const user = await this.client.database.getUser(rawInteraction.user.id)
        user.activisionUserString = `${platform};${username}`
        this.client.database.updateUser(user)
        return true
    }

    private async linkRocketName(rawInteraction: ChatInteraction, platform?: string, username?: string): Promise<boolean> {
        if (!platform || !username) return false
        const user = await this.client.database.getUser(rawInteraction.user.id)
        user.rocketLeagueUserString = `${platform};${username}`
        this.client.database.updateUser(user)
        return true
    }

    private async linkLastFMName(rawInteraction: BaseInteraction, username?: string): Promise<boolean> {
        if (!username) return false
        const user = await this.client.database.getUser(rawInteraction.user.id)
        user.lastFMUsername = username
        this.client.database.updateUser(user)
        return true
    }
    private async linkVivinoId(rawInteraction: BaseInteraction, username?: string): Promise<boolean> {
        if (!username) return false
        const user = await this.client.database.getUser(rawInteraction.user.id)
        user.vivinoId = username
        this.client.database.updateUser(user)
        return true
    }

    async linkVinmonopolToUser(storeIdFromInteraction: string, userId: string): Promise<string> {
        const storeId = parseInt(storeIdFromInteraction)
        if (!isNaN(storeId) && storeId < 1000) {
            const store = await PoletCommands.fetchPoletData(storeId.toString())
            if (!store) {
                return ''
            } else {
                const storeCoord = store.address.gpsCoord.split(';')
                const user = await this.client.database.getUser(userId)
                const favoritePol = {
                    id: storeId.toString(),
                    latitude: storeCoord[0],
                    longitude: storeCoord[1],
                }
                user.favoritePol = favoritePol
                this.client.database.updateUser(user)
                return `${store.storeName} (${store.storeId}), med adressen ${store.address.street} ${store.address.postalCode} ${store.address.city}`
            }
        } else {
            return ''
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'link',
                        command: (rawInteraction: ChatInteraction) => {
                            this.handleLinking(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
