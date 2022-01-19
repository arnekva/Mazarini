import { Client, Message, TextChannel } from 'discord.js'
import { imgflip } from '../client-env'
import { MessageHelper } from '../helpers/messageHelper'
import { replaceAtWithTextUsername } from '../utils/textUtils'
import { ICommandElement } from '../General/commands'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
const fetch = require('node-fetch')
export class Meme extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    private readonly baseURL = 'https://api.imgflip.com/caption_image'

    private async findMemeIdAndCreate(message: Message, content: string, args: string[]) {
        const memeString = args[0].toLowerCase()
        if (memeString == 'anakin' || memeString == '322841258') return await this.createMeme('322841258', content, message, args)
        if (memeString == 'timmy' || memeString == '26433458') return await this.createMeme('26433458', content, message, args)
        if (memeString == 'sjøsyk' || memeString == 'hallgeir') this.messageHelper.sendMessage(message.channelId, 'https://i.imgur.com/ka7SslJ.jpg')
        return
    }

    private async sendMeme(message: Message, content: string, args: string[]) {
        const meme = await this.findMemeIdAndCreate(message, content, args)
    }
    private async createMeme(templateId: string, messageContent: string, message: Message, args: string[]) {
        messageContent = replaceAtWithTextUsername(messageContent, message, true)
        const splitContent = messageContent.split(':')
        splitContent[0] = splitContent[0].split(' ').slice(1).join(' ')
        if (splitContent[0] && splitContent[1]) {
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
            params.append('boxes[0][text]', splitContent[0] ?? 'Mangler tekst')
            params.append('boxes[0][x]', box0Params.x)
            params.append('boxes[0][y]', box0Params.y)
            params.append('boxes[0][width]', box0Params.width)
            params.append('boxes[0][height]', box0Params.height)
            if (splitContent[1] && box1Params) {
                params.append('boxes[1][text]', splitContent[1] ?? 'Mangler tekst')
                params.append('boxes[1][x]', box1Params.x)
                params.append('boxes[1][y]', box1Params.y)
                params.append('boxes[1][width]', box1Params.width)
                params.append('boxes[1][height]', box1Params.height)
            }

            if (splitContent[2] && box2Params) {
                params.append('boxes[2][text]', splitContent[2] ?? 'Mangler tekst')
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
                            if (el.data) this.messageHelper.sendMessage(message.channelId, el.data.url)
                        })
                        .catch((error: any) => {
                            this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                        })
                })
                .catch((error: any) => {
                    this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                })
        } else {
            message.reply('Du mangler noen tekster')
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
        return [
            {
                commandName: 'meme',
                description: "Lag et meme. '!mz meme <anakin|timmy> text1:text2:text3:text4'",

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.sendMeme(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
        ]
    }
}
