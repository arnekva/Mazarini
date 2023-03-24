import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { WeatherUtils } from '../utils/weatherUtils'
const fetch = require('node-fetch')

export class Weather extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async getWeatherForGivenCity(interaction: ChatInputCommandInteraction<CacheType>) {
        const APIkey = 'fc7f85d19367afda9a6a3839919a820a'
        const rootUrl = 'https://api.openweathermap.org/data/2.5/weather?'
        await interaction.deferReply()
        const city = interaction.options.get('stedsnavn')?.value as string
        const cityWithoutSpecialChars = city.replace('æ', 'ae').replace('ø', 'o').replace('å', 'a')
        const fullUrl = rootUrl + 'q=' + cityWithoutSpecialChars + '&appid=' + APIkey + '&lang=NO'
        fetch(fullUrl, {
            method: 'GET',
        })
            .then((res: any) => {
                if (!res.ok) {
                    this.messageHelper.replyToInteraction(interaction, `Det har oppstått et problem for søket ditt på ${city}`, undefined, true)
                } else {
                    res.json().then((el: any) => {
                        const temperature: string = WeatherUtils.kelvinToCelcius(el.main.temp).toFixed(1).toString()
                        const weatherDescription = el.weather.map((weatherObj: any) => weatherObj.description).join(', ')

                        const weather = new EmbedBuilder()
                            .setTitle(`Været i ${el?.name}`)
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
                        const icon = el.weather[0].icon
                        if (icon) weather.setThumbnail(`http://openweathermap.org/img/wn/${icon}@2x.png`)
                        this.messageHelper.replyToInteraction(interaction, weather, undefined, true)
                    })
                }
            })
            .catch((error: Error) => {
                this.messageHelper.replyToInteraction(interaction, 'Fant ikke byen', undefined, true)
            })
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'weather',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.getWeatherForGivenCity(rawInteraction)
                },
            },
        ]
    }
}
