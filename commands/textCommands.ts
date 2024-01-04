import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import wiki from 'wikijs'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'

import { IInteractionElement } from '../interfaces/interactionInterface'
import { EmbedUtils } from '../utils/embedUtils'

export class TextCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async searchWiki(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const search = interaction.options.get('search')?.value as string
        const locale = interaction.options.get('locale')?.value as string

        const capitalizeFirstLetter = (text: string) => {
            if (text.charAt(0).toUpperCase() === text.charAt(0)) return text.charAt(0).toLowerCase() + text.slice(1)
            return text.charAt(0).toUpperCase() + text.slice(1)
        }

        let result
        const safeLocale = locale && locale === 'en' ? 'en' : 'no'
        //TODO: Refactor this
        try {
            result = await wiki({ apiUrl: `https://${safeLocale}.wikipedia.org/w/api.php` })?.page(search)
        } catch (error) {
            //Module throws an error instead of returning an error code/undefined for some reason ..
            //Since search is case sensitive, we try again with each word caopitalized
            const splitSearch = search.split(' ').map((word) => capitalizeFirstLetter(word))
            const search2 = splitSearch.join(' ')
            try {
                result = await wiki({ apiUrl: `https://${safeLocale}.wikipedia.org/w/api.php` })?.page(search2)
            } catch (error) {
                this.messageHelper.replyToInteraction(interaction, `Fant ingen sider på *${search}*. Husk at søket er case sensitive`, {
                    hasBeenDefered: true,
                })
            }
        }
        if (result) {
            const summary = (await result.summary()).slice(0, 450) + '...'
            const image = await result.mainImage()
            const embed = EmbedUtils.createSimpleEmbed(`${search}`, summary)

            if (image) embed.setThumbnail(image)
            embed.setURL(result.url())
            this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true })
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'wiki',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.searchWiki(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
