import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import wiki from 'wikijs'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { EmbedUtils } from '../utils/embedUtils'

export class TextCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async searchWiki(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const search = interaction.options.get('search')?.value as string

        try {
            const result = await wiki({ apiUrl: 'https://no.wikipedia.org/w/api.php' })?.page(search)
            if (result) {
                const summary = (await result.summary()).slice(0, 500) + '..'
                const image = await result.mainImage()

                const embed = EmbedUtils.createSimpleEmbed(`${search}`, summary)
                if (image) embed.setThumbnail(image)
                embed.setURL(result.url())
                this.messageHelper.replyToInteraction(interaction, embed, false, true)
            }
        } catch (error) {
            this.messageHelper.replyToInteraction(interaction, `Fant ingen sider på *${search}*`, false, true)
        }
    }

    getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'wiki',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.searchWiki(rawInteraction)
                },
                category: 'annet',
            },
        ]
    }
}
