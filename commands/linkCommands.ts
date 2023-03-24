import { CacheType, ChatInputCommandInteraction, Client, Interaction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { PoletCommands } from './poletCommands'

export class LinkCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async handleLinking(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()

        const isWZ = interaction.options.getSubcommand() === 'warzone'
        const isRocket = interaction.options.getSubcommand() === 'rocket'
        const isLastFM = interaction.options.getSubcommand() === 'lastfm'
        const isVinmonopol = interaction.options.getSubcommand() === 'vinmonopol'

        let saved = false
        let msg = ''
        if (isWZ) {
            const platform = interaction.options.get('plattform')?.value as string
            const username = interaction.options.get('brukernavn')?.value as string
            msg = `Linket *${username}* *${platform}* til brukeren din for Warzone`

            saved = this.linkWZName(interaction, platform, username)
        } else if (isRocket) {
            const platform = interaction.options.get('plattform')?.value as string
            const username = interaction.options.get('brukernavn')?.value as string
            saved = this.linkRocketName(interaction, platform, username)
            msg = `Linket *${username}* *${platform}* til brukeren din for Rocket League`
        } else if (isLastFM) {
            const username = interaction.options.get('brukernavn')?.value as string
            saved = this.linkLastFMName(interaction, username)
            msg = `Linket *${username}* til brukeren din for Last.fm`
        } else if (isVinmonopol) {
            const polID = interaction.options.get('vinmonopolid')?.value as string
            const data = await this.linkVinmonopolToUser(polID, interaction.user.id)
            saved = !!data
            msg = `Vinmonopolet ${data} er lagret på brukeren din`
        }

        if (saved) this.messageHelper.replyToInteraction(interaction, msg, undefined, true)
        else this.messageHelper.replyToInteraction(interaction, 'Klarte ikke hente brukernavn eller plattform', undefined, true)
    }

    private linkWZName(rawInteraction: ChatInputCommandInteraction<CacheType>, platform?: string, username?: string): boolean {
        if (!platform || !username) return false
        const user = DatabaseHelper.getUser(rawInteraction.user.id)
        user.activisionUserString = `${platform};${username}`
        DatabaseHelper.updateUser(user)
        return true
    }

    private linkRocketName(rawInteraction: ChatInputCommandInteraction<CacheType>, platform?: string, username?: string): boolean {
        if (!platform || !username) return false
        const user = DatabaseHelper.getUser(rawInteraction.user.id)
        user.rocketLeagueUserString = `${platform};${username}`
        DatabaseHelper.updateUser(user)
        return true
    }

    private linkLastFMName(rawInteraction: Interaction<CacheType>, username?: string): boolean {
        if (!username) return false
        const user = DatabaseHelper.getUser(rawInteraction.user.id)
        user.lastFMUsername = username
        DatabaseHelper.updateUser(user)
        return true
    }

    async linkVinmonopolToUser(storeIdFromInteraction: string, userId: string): Promise<string> {
        const storeId = parseInt(storeIdFromInteraction)
        if (!isNaN(storeId) && storeId < 1000) {
            const store = await PoletCommands.fetchPoletData(undefined, storeId.toString())
            if (!store) {
                return ''
            } else {
                const user = DatabaseHelper.getUser(userId)
                user.favoritePol = storeId.toString()
                DatabaseHelper.updateUser(user)
                return `${store.storeName} (${store.storeId}), med adressen ${store.address.street} ${store.address.postalCode} ${store.address.city}`
            }
        } else {
            return ''
        }
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'link',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.handleLinking(rawInteraction)
                },
                category: 'gaming',
            },
        ]
    }
}
