import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { imgflip } from '../client-env'
import { ICommandElement, IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
const fetch = require('node-fetch')
export class Meme extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    private readonly baseURL = 'https://api.imgflip.com/caption_image'

    private async findMemeIdAndCreate(meme: string, interaction: ChatInputCommandInteraction<CacheType>) {
        if (meme == 'anakin') return await this.createMeme('322841258', interaction)
        if (meme == 'timmy') return await this.createMeme('26433458', interaction)
        if (meme == 'sjosyk') return await this.messageHelper.sendMessage(interaction.channelId, 'https://i.imgur.com/ka7SslJ.jpg')
    }

    private async sendMeme(interaction: ChatInputCommandInteraction<CacheType>) {
        const meme = await this.findMemeIdAndCreate(interaction.options.get('meme')?.value as string, interaction)
    }
    private async createMeme(templateId: string, interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const text1 = interaction.options.get('tekst-1')?.value as string
        const text2 = interaction.options.get('tekst-2')?.value as string
        const text3 = interaction.options.get('tekst-3')?.value as string
        const text4 = interaction.options.get('tekst-4')?.value as string

        if (text1 && text2) {
            const id = templateId
            const fetchUrl = this.baseURL + ``
            const params = new URLSearchParams({
                username: imgflip.u,
                password: imgflip.p,
                template_id: id,
                text0: 'tomas',
                text1: 'toget',
                max_font_size: '25',
            })
            const box0Params = this.getBoxCoords(templateId).filter((e) => e.boxId == '0')[0]
            const box1Params = this.getBoxCoords(templateId).filter((e) => e.boxId == '1')[0]
            const box2Params = this.getBoxCoords(templateId).filter((e) => e.boxId == '2')[0]
            params.append('boxes[0][text]', text1 ?? 'Mangler tekst')
            params.append('boxes[0][x]', box0Params.x)
            params.append('boxes[0][y]', box0Params.y)
            params.append('boxes[0][width]', box0Params.width)
            params.append('boxes[0][height]', box0Params.height)
            if (text2 && box1Params) {
                params.append('boxes[1][text]', text2 ?? 'Mangler tekst')
                params.append('boxes[1][x]', box1Params.x)
                params.append('boxes[1][y]', box1Params.y)
                params.append('boxes[1][width]', box1Params.width)
                params.append('boxes[1][height]', box1Params.height)
            }

            if (text3 && box2Params) {
                params.append('boxes[2][text]', text3 ?? 'Mangler tekst')
                params.append('boxes[2][x]', box2Params.x)
                params.append('boxes[2][y]', box2Params.y)
                params.append('boxes[2][width]', box2Params.width)
                params.append('boxes[2][height]', box2Params.height)
            }

            fetch(fetchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: params,
            })
                .then((res: any) => {
                    res.json()
                        .then((el: any) => {
                            if (el.data) this.messageHelper.sendMessage(interaction.channelId, el.data.url)
                            this.messageHelper.replyToInteraction(interaction, `Lagde et meme te deg bro`, true, true)
                        })
                        .catch((error: any) => {
                            this.messageHelper.replyToInteraction(interaction, `her skjedde det ein feil. Hvis det skjer igjen tag @Bot-support`, true, true)
                        })
                })
                .catch((error: any) => {
                    this.messageHelper.replyToInteraction(interaction, `her skjedde det ein feil. Hvis det skjer igjen tag @Bot-support`, true, true)
                })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Det mangle någen tekster`, true, true)
        }
    }

    private getBoxCoords(id: string): {
        boxId: string
        x: string
        y: string
        width: string
        height: string
    }[] {
        //Specific for Anakin
        if (id === '322841258') {
            const commonWidth = '400'
            const commonHeight = '100'
            return [
                {
                    boxId: '0',
                    x: '10',
                    y: '300',
                    width: commonWidth,
                    height: commonHeight,
                },
                {
                    boxId: '1',
                    x: '375',
                    y: '10',
                    width: commonWidth,
                    height: commonHeight,
                },
                {
                    boxId: '2',
                    x: '375',
                    y: '650',
                    width: commonWidth,
                    height: commonHeight,
                },
            ]
        }
        //Timmys Dad meme
        if (id === '26433458') {
            const commonWidth = '310'
            const commonHeight = '100'
            return [
                {
                    boxId: '0',
                    x: '-10',
                    y: '145',
                    width: commonWidth,
                    height: commonHeight,
                },
                {
                    boxId: '1',
                    x: '-10',
                    y: '325',
                    width: commonWidth,
                    height: commonHeight,
                },
            ]
        }
        return [{ boxId: '0', x: '10', y: '300', width: '300', height: '100' }]
    }

    public getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'meme',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.sendMeme(rawInteraction)
                },
                category: 'annet',
            },
        ]
    }
}
