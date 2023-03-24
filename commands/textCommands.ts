import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import wiki from 'wikijs'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { EmbedUtils } from '../utils/embedUtils'

export class TextCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async searchWiki(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const search = interaction.options.get('search')?.value as string

        const capitalizeFirstLetter = (text: string) => {
            if (text.charAt(0).toUpperCase() === text.charAt(0)) return text.charAt(0).toLowerCase() + text.slice(1)
            return text.charAt(0).toUpperCase() + text.slice(1)
        }

        let result
        try {
            result = await wiki({ apiUrl: 'https://no.wikipedia.org/w/api.php' })?.page(search)
        } catch (error) {
            const splitSearch = search.split(' ').map((word) => capitalizeFirstLetter(word))
            const search2 = splitSearch.join(' ')
            try {
                result = await wiki({ apiUrl: 'https://no.wikipedia.org/w/api.php' })?.page(search2)
            } catch (error) {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Fant ingen sider på *${search}* eller *${search2}*. Husk at søket er case sensitive`,
                    false,
                    true
                )
            }
        }
        if (result) {
            const summary = (await result.summary()).slice(0, 450) + '...'
            const image = await result.mainImage()
            const embed = EmbedUtils.createSimpleEmbed(`${search}`, summary)

            if (image) embed.setThumbnail(image)
            embed.setURL(result.url())
            this.messageHelper.replyToInteraction(interaction, embed, false, true)
        }
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'wiki',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.searchWiki(rawInteraction)
                },
            },
        ]
    }
}
