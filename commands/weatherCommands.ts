import { Message } from "discord.js";
import { MessageHelper } from '../helpers/messageHelper'
import { ICommandElement } from './commands'
const fetch = require('node-fetch')
import { WeatherUtils } from "../utils/weatherUtils"

export class Weather {


    static getWeatherForGivenCity(message: Message, city: string) {
        const APIkey = "fc7f85d19367afda9a6a3839919a820a"
        const rootUrl = "https://api.openweathermap.org/data/2.5/weather?"

        const cityWithoutSpecialChars = city
            .replace("æ", "ae")
            .replace("ø", "o")
            .replace("å", "a")

        const fullUrl = rootUrl + "q=" + cityWithoutSpecialChars + "&appid=" + APIkey + "&lang=NO";
        const response = city

        fetch(fullUrl, {
            method: 'GET',
            
        })
        .then((res: any) => {
            if (!res.ok) {
                throw new Error(res.status.toString())
            }
            res.json()
                .then((el: any) => {
                    console.log(el)
                    const temperature : string = 
                        WeatherUtils
                        .kelvinToCelcius(el.main.temp)
                        .toFixed(1)
                        .toString()

                    const weatherDescription = el.weather
                        .map((weatherObj: any) => weatherObj.description)
                        .join(', ')
                    const response = "Været i " + el.name + " er nå " + weatherDescription + " med " + temperature + " grader."
                    
                    MessageHelper.sendMessage(message, response)
                })
            }).catch((error: Error) => {
                MessageHelper.sendMessage(message, "" + error  + " - city not found")
            })
    }

    static readonly getWeatherForGivenCityCommand: ICommandElement = {
        commandName: 'vær',
        description: 'Sjekk været på et gitt sted',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            Weather.getWeatherForGivenCity(rawMessage, messageContent)
        },
        category: 'annet',
    }
}