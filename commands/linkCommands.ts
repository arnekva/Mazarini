import { CacheType, ChatInputCommandInteraction, Client, CommandInteraction, Interaction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { PoletCommands } from './poletCommands'

export class LinkCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async handleLinking(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            const isWZ = interaction?.options?.getSubcommand() === 'warzone'
            const isLastFM = interaction?.options?.getSubcommand() === 'lastfm'
            const isVinmonopol = interaction?.options?.getSubcommand() === 'vinmonopol'

            let saved = false
            if (isWZ) {
                const platform = interaction?.options?.get('plattform')?.value as string
                const username = interaction?.options?.get('brukernavn')?.value as string

                saved = this.linkWZName(interaction, platform, username)
            } else if (isLastFM) {
                const username = interaction?.options?.get('brukernavn')?.value as string
                saved = this.linkLastFMName(interaction, username)
            } else if (isVinmonopol) {
                const polID = interaction?.options?.get('vinmonopolid')?.value as string
                saved = await this.linkVinmonopolToUser(polID, interaction.user.id)
            }

            if (saved) this.messageHelper.replyToInteraction(interaction, 'Brukernavnet er nå linket til din konto')
            else this.messageHelper.replyToInteraction(interaction, 'Klarte ikke hente brukernavn eller plattform')
        } else {
            const intr = interaction as CommandInteraction
            intr.reply('En feil har oppstått')
        }
    }

    private linkWZName(rawInteraction: ChatInputCommandInteraction<CacheType>, platform?: string, username?: string): boolean {
        if (!platform || !username) return false
        const user = DatabaseHelper.getUser(rawInteraction.user.id)
        user.activisionUserString = `${platform};${username}`
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

    async linkVinmonopolToUser(storeIdFromInteraction: string, userId: string): Promise<boolean> {
        const storeId = parseInt(storeIdFromInteraction)
        if (!isNaN(storeId) && storeId < 1000) {
            const store = await PoletCommands.fetchPoletData(undefined, storeId.toString(), true)
            if (!store) {
                return false
            } else {
                const user = DatabaseHelper.getUser(userId)
                user.favoritePol = storeId.toString()
                DatabaseHelper.updateUser(user)
                return true
            }
        } else {
            return false
        }
    }

    getAllCommands(): ICommandElement[] {
        return []
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
