import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { imgflip } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'

import { Meme, MemeBox } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { MentionUtils } from '../../utils/mentionUtils'

const fetch = require('node-fetch')

export class MemeCommands extends AbstractCommands {
    private memes: Meme[]

    constructor(client: MazariniClient) {
        super(client)
    }

    private async retrieveMemes() {
        this.memes = await this.client.database.getMemes()
    }
    private readonly baseURL = 'https://api.imgflip.com/caption_image'

    private sendToAll(interaction: ButtonInteraction<CacheType>) {
        const img = interaction.customId.split(';')[1]
        this.messageHelper.sendMessage(interaction.channelId, { text: img })
        fetch(`https://discord.com/api/webhooks/${MentionUtils.User_IDs.BOT_HOIE}/${interaction.token}/messages/@original`, {
            method: 'DELETE',
        })
        interaction.deferUpdate()
    }

    private getMeme(interaction: ChatInputCommandInteraction<CacheType>) {
        const memeId = interaction.options.get('meme')?.value as string
        if (memeId == '000') {
            return this.messageHelper.replyToInteraction(interaction, 'https://i.imgur.com/ka7SslJ.jpg')
        }
        const meme = this.memes.find((meme) => meme.id == memeId)

        if (!meme) {
            this.messageHelper.replyToInteraction(interaction, `Denne memen finnes ikkje`, {
                ephemeral: true,
                hasBeenDefered: false,
            })
        } else {
            this.captionMeme(meme, interaction)
        }
    }

    private async captionMeme(meme: Meme, interaction: ChatInputCommandInteraction<CacheType>) {
        const preview = interaction.options.get('preview')?.value as boolean
        await interaction.deferReply({ ephemeral: preview })

        let params = new URLSearchParams({
            username: imgflip.u,
            password: imgflip.p,
            template_id: meme.id,
            text0: 'tomas',
            text1: 'toget',
            max_font_size: '25',
        })
        
        params = this.getBoxes(meme, params, interaction)
        
        fetch(this.baseURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            },
            body: params,
        })
            .then((res: any) => {
                res.json()
                    .then((el: any) => {
                        if (el.data) {
                            if (preview) {
                                const btn = sendMemeBtn(el.data.url)
                                this.messageHelper.replyToInteraction(interaction, el.data.url, { ephemeral: true, hasBeenDefered: true }, [btn])
                            } else {
                                this.messageHelper.replyToInteraction(interaction, el.data.url, { ephemeral: false, hasBeenDefered: true })
                            }
                        } else {
                            this.messageHelper.replyToInteraction(interaction, `Klarte ikkje å laga et meme te deg bro`, {
                                ephemeral: true,
                                hasBeenDefered: true,
                            })
                            this.messageHelper.sendLogMessage('Klarte ikke å generere meme\n', el)
                            
                        }
                    })
                    .catch((error: any) => {
                        this.messageHelper.replyToInteraction(interaction, `her skjedde det ein feil. Hvis det skjer igjen tag @Bot-support`, {
                            ephemeral: true,
                            hasBeenDefered: true,
                        })
                        this.messageHelper.sendLogMessage('Klarte ikke å parse meme json\n', error)
                    })
            })
            .catch((error: any) => {
                this.messageHelper.replyToInteraction(interaction, `her skjedde det ein feil. Hvis det skjer igjen tag @Bot-support`, {
                    ephemeral: true,
                    hasBeenDefered: true,
                })
                this.messageHelper.sendLogMessage('Klarte ikke å request-e en meme\n', error)
            })
    }

    private getBoxes(meme: Meme, params: URLSearchParams, interaction: ChatInputCommandInteraction<CacheType>) {
        for (let i = 0; i < meme.box_count; i++) {
            const text = interaction.options.get(`tekst-${i+1}`)?.value as string
            params.append(`boxes[${i}][text]`, text ?? ' ')
            
            const box: MemeBox = (meme.boxes?.length ?? 0) > i ? meme.boxes[i] : undefined
            if (box) {
                if (box.x) params.append(`boxes[${i}][x]`, `${box.x}`)
                if (box.y) params.append(`boxes[${i}][y]`, `${box.y}`)
                if (box.width) params.append(`boxes[${i}][width]`, `${box.width}`) 
                if (box.height) params.append(`boxes[${i}][height]`, `${box.height}`)
                if (box.color) params.append(`boxes[${i}][color]`, `${box.color}` )
                if (box.outline_color) params.append(`boxes[${i}][outline_color]`, `${box.outline_color}`)
            }
        }
        return params
    }

    private async filterMemes(interaction: AutocompleteInteraction<CacheType>) {
        if (!this.memes) await this.retrieveMemes()
        const optionList: any = interaction.options
        const input = optionList.getFocused().toLowerCase()
        const options = this.memes
            .filter((meme: Meme) => meme.name.toLowerCase().includes(input) || meme.tags.some((t) => t.toLowerCase().includes(input)))
            .slice(0, 24)
            .map((meme) => ({ name: `${meme.name} (${meme.box_count})`, value: meme.id }))
        interaction.respond(options)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'meme',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.getMeme(rawInteraction)
                        },
                        autoCompleteCallback: (rawInteraction: AutocompleteInteraction<CacheType>) => {
                            this.filterMemes(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'SEND_MEME',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.sendToAll(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

const sendMemeBtn = (img: any) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `SEND_MEME;${img}`,
            style: ButtonStyle.Primary,
            label: `Send til alle`,
            disabled: false,
            type: 2,
        })
    )
}

export interface IMemeTemplate {
    id: string
    name: string
    url: string
    width: number
    height: number
    box_count: number
    captions: number
    tags: string[]
}
