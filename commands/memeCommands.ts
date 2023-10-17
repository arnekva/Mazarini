import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { imgflip } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'
const fetch = require('node-fetch')
export class Meme extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }
    private readonly baseURL = 'https://api.imgflip.com/caption_image'

    private async sendMeme(interaction: ChatInputCommandInteraction<CacheType>) {
        const memeId = interaction.options.get('meme')?.value as string
        if (memeId == 'sjosyk') {
            return this.messageHelper.replyToInteraction(interaction, 'https://i.imgur.com/ka7SslJ.jpg')
        }
        const meme = memeMap.get(memeId)
        if (!meme)
            this.messageHelper.replyToInteraction(interaction, `her skjedde det ein feil. Hvis det skjer igjen tag @Bot-support`, {
                ephemeral: true,
                hasBeenDefered: false,
            })
        this.captionMeme(meme, interaction)
    }

    private async captionMeme(meme: IMemeTemplate, interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()

        const params = new URLSearchParams({
            username: imgflip.u,
            password: imgflip.p,
            template_id: meme.id,
            text0: 'tomas',
            text1: 'toget',
            max_font_size: '25',
        })
        if (meme.numberOfBoxes > 0) {
            const text = interaction.options.get('tekst-1')?.value as string
            params.append('boxes[0][text]', text ?? ' ')
        }
        if (meme.numberOfBoxes > 1) {
            const text = interaction.options.get('tekst-2')?.value as string
            params.append('boxes[1][text]', text ?? ' ')
        }
        if (meme.numberOfBoxes > 2) {
            const text = interaction.options.get('tekst-3')?.value as string
            params.append('boxes[2][text]', text ?? ' ')
        }
        if (meme.numberOfBoxes > 3) {
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
                        if (el.data) this.messageHelper.replyToInteraction(interaction, el.data.url, { hasBeenDefered: true })
                        else
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

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'meme',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.sendMeme(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

export interface IMemeTemplate {
    id: string
    name: string
    numberOfBoxes: number
}

export const memeMap: Map<string, IMemeTemplate> = new Map<string, IMemeTemplate>([
    ['sjosyk', { id: 'sjosyk', name: 'Økonomisk sjøsyk', numberOfBoxes: 0 }],
    ['26433458', { id: '26433458', name: "Timmy's dad", numberOfBoxes: 2 }],
    ['322841258', { id: '322841258', name: 'Anakin', numberOfBoxes: 3 }],
    ['217743513', { id: '217743513', name: 'Uno draw 25', numberOfBoxes: 2 }],
    ['438680', { id: '438680', name: 'Batman slapping Robin', numberOfBoxes: 2 }],
    ['124822590', { id: '124822590', name: 'Exit off ramp', numberOfBoxes: 3 }],
    ['102156234', { id: '102156234', name: 'Special needs Spongebob', numberOfBoxes: 2 }],
    ['131940431', { id: '131940431', name: "Gru's plan", numberOfBoxes: 4 }],
    ['87743020', { id: '87743020', name: 'Two buttons', numberOfBoxes: 3 }],
    ['178591752', { id: '178591752', name: 'Tuxedo Winnie The Pooh', numberOfBoxes: 2 }],
    ['21735', { id: '21735', name: 'The Rock driving', numberOfBoxes: 2 }],
    ['84341851', { id: '84341851', name: 'Darth Kermit', numberOfBoxes: 2 }],
    ['155067746', { id: '155067746', name: 'Surprised Pikachu', numberOfBoxes: 3 }],
    ['119139145', { id: '119139145', name: 'Blue button', numberOfBoxes: 2 }],
    ['180190441', { id: '180190441', name: "They're the same picture", numberOfBoxes: 3 }],
    ['79132341', { id: '79132341', name: 'Stick in bike wheel', numberOfBoxes: 3 }],
    ['27813981', { id: '27813981', name: 'Hide the pain Harold', numberOfBoxes: 2 }],
    ['148909805', { id: '148909805', name: 'Avoid eye contact', numberOfBoxes: 2 }],
    ['61579', { id: '61579', name: 'One does not simply', numberOfBoxes: 2 }],
    ['252600902', { id: '252600902', name: 'Space - always has been', numberOfBoxes: 2 }],
    ['4087833', { id: '4087833', name: 'Waiting skeleton', numberOfBoxes: 2 }],
    ['129242436', { id: '129242436', name: 'Change my mind', numberOfBoxes: 2 }],
    ['181913649', { id: '181913649', name: 'Drake hotline bling', numberOfBoxes: 2 }],
    ['80707627', { id: '80707627', name: 'Sad Pablo Escobar', numberOfBoxes: 3 }],
    ['166969924', { id: '166969924', name: 'Flex tape', numberOfBoxes: 3 }],
])
