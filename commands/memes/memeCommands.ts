import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { imgflip } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'

import { Meme } from '../../interfaces/database/databaseInterface'
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

    private async sendToAll(interaction: ButtonInteraction<CacheType>) {
        const img = interaction.customId.split(';')[1]
        this.messageHelper.sendMessage(interaction.channelId, { text: img })
        fetch(`https://discord.com/api/webhooks/${MentionUtils.User_IDs.BOT_HOIE}/${interaction.token}/messages/@original`, {
            method: 'DELETE',
        })
        interaction.deferUpdate()
    }

    private async getMeme(interaction: ChatInputCommandInteraction<CacheType>) {
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

        const params = new URLSearchParams({
            username: imgflip.u,
            password: imgflip.p,
            template_id: meme.id,
            text0: 'tomas',
            text1: 'toget',
            max_font_size: '25',
        })
        if (meme.box_count > 0) {
            const text = interaction.options.get('tekst-1')?.value as string
            params.append('boxes[0][text]', text ?? ' ')
        }
        if (meme.box_count > 1) {
            const text = interaction.options.get('tekst-2')?.value as string
            params.append('boxes[1][text]', text ?? ' ')
        }
        if (meme.box_count > 2) {
            const text = interaction.options.get('tekst-3')?.value as string
            params.append('boxes[2][text]', text ?? ' ')
        }
        if (meme.box_count > 3) {
            const text = interaction.options.get('tekst-4')?.value as string
            params.append('boxes[3][text]', text ?? ' ')
        }

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
                        } else
                            this.messageHelper.replyToInteraction(interaction, `Klarte ikkje å laga et meme te deg bro`, {
                                ephemeral: true,
                                hasBeenDefered: true,
                            })
                    })
                    .catch((error: any) => {
                        this.messageHelper.replyToInteraction(interaction, `her skjedde det ein feil. Hvis det skjer igjen tag @Bot-support`, {
                            ephemeral: true,
                            hasBeenDefered: true,
                        })
                    })
            })
            .catch((error: any) => {
                this.messageHelper.replyToInteraction(interaction, `her skjedde det ein feil. Hvis det skjer igjen tag @Bot-support`, {
                    ephemeral: true,
                    hasBeenDefered: true,
                })
            })
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
// export const memeMap: Map<string, IMemeTemplate> = new Map<string, IMemeTemplate>([
//     ['sjosyk', { id: 'sjosyk', name: 'Økonomisk sjøsyk', numberOfBoxes: 0 }],
//     ['26433458', { id: '26433458', name: "Timmy's dad", numberOfBoxes: 2 }],
//     ['322841258', { id: '322841258', name: 'Anakin', numberOfBoxes: 3 }],
//     ['217743513', { id: '217743513', name: 'Uno draw 25', numberOfBoxes: 2 }],
//     ['438680', { id: '438680', name: 'Batman slapping Robin', numberOfBoxes: 2 }],
//     ['124822590', { id: '124822590', name: 'Exit off ramp', numberOfBoxes: 3 }],
//     ['102156234', { id: '102156234', name: 'Special needs Spongebob', numberOfBoxes: 2 }],
//     ['131940431', { id: '131940431', name: "Gru's plan", numberOfBoxes: 4 }],
//     ['87743020', { id: '87743020', name: 'Two buttons', numberOfBoxes: 3 }],
//     ['178591752', { id: '178591752', name: 'Tuxedo Winnie The Pooh', numberOfBoxes: 2 }],
//     ['21735', { id: '21735', name: 'The Rock driving', numberOfBoxes: 2 }],
//     ['84341851', { id: '84341851', name: 'Darth Kermit', numberOfBoxes: 2 }],
//     ['155067746', { id: '155067746', name: 'Surprised Pikachu', numberOfBoxes: 3 }],
//     ['119139145', { id: '119139145', name: 'Blue button', numberOfBoxes: 2 }],
//     ['180190441', { id: '180190441', name: "They're the same picture", numberOfBoxes: 3 }],
//     ['79132341', { id: '79132341', name: 'Stick in bike wheel', numberOfBoxes: 3 }],
//     ['27813981', { id: '27813981', name: 'Hide the pain Harold', numberOfBoxes: 2 }],
//     ['148909805', { id: '148909805', name: 'Avoid eye contact', numberOfBoxes: 2 }],
//     ['61579', { id: '61579', name: 'One does not simply', numberOfBoxes: 2 }],
//     ['252600902', { id: '252600902', name: 'Space - always has been', numberOfBoxes: 2 }],
//     ['4087833', { id: '4087833', name: 'Waiting skeleton', numberOfBoxes: 2 }],
//     ['129242436', { id: '129242436', name: 'Change my mind', numberOfBoxes: 2 }],
//     ['181913649', { id: '181913649', name: 'Drake hotline bling', numberOfBoxes: 2 }],
//     ['80707627', { id: '80707627', name: 'Sad Pablo Escobar', numberOfBoxes: 3 }],
//     ['166969924', { id: '166969924', name: 'Flex tape', numberOfBoxes: 3 }],
// ])
