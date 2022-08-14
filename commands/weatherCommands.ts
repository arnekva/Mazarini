import { Client, EmbedBuilder, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { WeatherUtils } from '../utils/weatherUtils'
const fetch = require('node-fetch')

export class Weather extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private getWeatherForGivenCity(message: Message, city: string) {
        const APIkey = 'fc7f85d19367afda9a6a3839919a820a'
        const rootUrl = 'https://api.openweathermap.org/data/2.5/weather?'

        const cityWithoutSpecialChars = city.replace('æ', 'ae').replace('ø', 'o').replace('å', 'a')

        const fullUrl = rootUrl + 'q=' + cityWithoutSpecialChars + '&appid=' + APIkey + '&lang=NO'
        const response = city

        fetch(fullUrl, {
            method: 'GET',
        })
            .then((res: any) => {
                if (!res.ok) {
                    console.log('throws error')

                    // throw new Error(res.status.toString())
                    //TODO: Do not throw error, log it instead
                } else {
                    console.log(res)

                    res.json().then((el: any) => {
                        const temperature: string = WeatherUtils.kelvinToCelcius(el.main.temp).toFixed(1).toString()
                        const weatherDescription = el.weather.map((weatherObj: any) => weatherObj.description).join(', ')
                        const weather = new EmbedBuilder()
                            .setTitle(`☁️ Vær - ${el?.name} ☀️`)
                            .setDescription(`Været i dag`)
                            .addFields({
                                name: 'Temperatur',
                                value: `Det er ${temperature} grader (føles som ${WeatherUtils.kelvinToCelcius(el.main.feels_like)
                                    .toFixed(1)
                                    .toString()}).\nLaveste er ${WeatherUtils.kelvinToCelcius(el.main.temp_min)
                                    .toFixed(1)
                                    .toString()}°, høyeste er ${WeatherUtils.kelvinToCelcius(el.main.temp_max).toFixed(1).toString()}°`,
                            })
                            .addFields({ name: `Forhold`, value: `Det er ${weatherDescription}` })
                            .addFields({ name: `Vind`, value: `${el?.wind?.speed} m/s` })

                        this.messageHelper.sendFormattedMessage(message.channel as TextChannel, weather)
                    })
                }
            })
            .catch((error: Error) => {
                this.messageHelper.sendMessage(message.channelId, 'Fant ikke byen')
            })
    }
    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'vær',
                description: 'Sjekk været på et gitt sted',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.getWeatherForGivenCity(rawMessage, messageContent)
                },
                category: 'annet',
            },
        ]
    }
    getAllInteractions(): IInteractionElement[] {
        return []
    }
}
