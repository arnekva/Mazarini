import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { WeatherUtils } from '../utils/weatherUtils'
import { openCageAPIKey, openWeatherAPIKey } from '../client-env'
import { DateUtils } from '../utils/dateUtils'
const fetch = require('node-fetch')
const NodeGeocoder = require('node-geocoder')

interface GeoLocation {
    latitude: string
    longitude: string
    country: string
    city: string
    state: string
    zipcode: string
    streetName: string
    streetNumber: string
    countryCode: string
    county: string
    extra: { confidence: string, confidenceKM: string }
    provider: string
}

export class Weather extends AbstractCommands {
    static baseUrl = 'https://api.met.no/weatherapi/locationforecast/2.0/complete'
    static iconUrl = 'https://api.met.no/images/weathericons/png/'

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    static geocoder = NodeGeocoder({
        provider: 'opencage',
        apiKey: openCageAPIKey,
        formatter: null
    })

    static async fetchMETWeatherForCoordinates(latitude: string, longitude: string) {
        const data = await fetch(`${Weather.baseUrl}?lat=${latitude}&lon=${longitude}`, {
            method: 'GET',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            },
        })
        return await data.json()
    }

    static async fetchOPENWeatherForCity(city: string) {
        const rootUrl = 'https://api.openweathermap.org/data/2.5/weather?'
        const cityWithoutSpecialChars = city.replace('æ', 'ae').replace('ø', 'o').replace('å', 'a')
        const fullUrl = rootUrl + 'q=' + cityWithoutSpecialChars + '&appid=' + openWeatherAPIKey + '&lang=NO'
        const data = await fetch(fullUrl, {
            method: 'GET',
        })
        return await data.json()
    }

    static GeoLocationString(location: GeoLocation) {
        return location.streetName ? `${location.streetName} ${location.streetNumber}, ${location.city}` : location.city
    }

    private async getWeatherForGivenCity(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const city = interaction.options.get('stedsnavn')?.value as string
        const geoLocation = await Weather.getCoordinatesForLocation(city)
        if (geoLocation == undefined) return this.messageHelper.replyToInteraction(interaction, `Finner ikke stedet "${city}"`, undefined, true)

        const data = await Weather.fetchMETWeatherForCoordinates(geoLocation.latitude, geoLocation.longitude)
        const today = this.getTodaysTimeseries(data)
        const conditions = await Weather.fetchOPENWeatherForCity(geoLocation.city)

        const weatherConditions = conditions.weather.map((weatherObj: any) => weatherObj.description).join(', ')
        const startOfCurrentHour = today[0]        
        const endOfCurrentHour = today[1]
        const closestHour = new Date().getMinutes() < 30 ? startOfCurrentHour : endOfCurrentHour
        const currentTemp = this.getWeightedAverage(startOfCurrentHour.data.instant.details.air_temperature, endOfCurrentHour.data.instant.details.air_temperature)
        const currentWind = this.getWeightedAverage(startOfCurrentHour.data.instant.details.wind_speed, endOfCurrentHour.data.instant.details.wind_speed)
        
        const weather = new EmbedBuilder()
            .setTitle(`${Weather.GeoLocationString(geoLocation)}`)
            .setDescription(`Det er ${weatherConditions}`)
            .addFields({ name: 'Temperatur', value: `${currentTemp} °C :thermometer:`, inline: true })
            .addFields({ name: '\t\t', value: '\t\t', inline: true})
            .addFields({ name: 'Min/Maks', value: `${this.getMinMaxTempString(today, currentTemp)}`, inline: true})
            .addFields({ name: `Vind`, value: `${currentWind} m/s ${WeatherUtils.windDegreesToDirectionalArrow(Number(closestHour.data.instant.details.wind_from_direction))} :dash:`, inline: true })
            .addFields({ name: '\t\t', value: '\t\t', inline: true})
            .addFields({ name: `Regn 1t / 6t`, value: `${closestHour.data.next_1_hours.details.precipitation_amount} mm / ${closestHour.data.next_6_hours.details.precipitation_amount} mm` , inline: true})
            
        const icon = closestHour.data.next_1_hours.summary.symbol_code
        if (icon) weather.setThumbnail(`${Weather.iconUrl}${icon}.png`)
        this.messageHelper.replyToInteraction(interaction, weather, undefined, true)
    }

    private getMinMaxTempString(data:any, currentTemp: string) {
        const sortedByTemp = [...data].slice(1, undefined).sort((a,b) => Number(a.data.instant.details.air_temperature) - Number(b.data.instant.details.air_temperature))
        const highestTemp = Number(currentTemp) > sortedByTemp[sortedByTemp.length-1].data.instant.details.air_temperature ? Number(currentTemp) : sortedByTemp[sortedByTemp.length-1].data.instant.details.air_temperature
        const lowestTemp = Number(currentTemp) < sortedByTemp[0].data.instant.details.air_temperature ? Number(currentTemp) : sortedByTemp[0].data.instant.details.air_temperature
        return `${lowestTemp}°C / ${highestTemp}°C`
    }

    private getWeightedAverage(a,b) {
        const diff = Number(b) - Number(a)
        const weight = new Date().getMinutes() / 60
        return (Number(a) + (diff * weight)).toFixed(1)
    }

    private getTodaysTimeseries(data: any) {
        let nowIndex = 0
        const timeSeries = data.properties.timeseries        
        for (var i = 0; i < timeSeries.length; i++) {
            let date = new Date(timeSeries[i].time)
            if (DateUtils.dateIsWithinLastHour(date)) {                
                nowIndex = i
            }
            if (!DateUtils.isToday(date, true)) {
                return timeSeries.slice(nowIndex, i)
            }
        }
        return timeSeries[0]
    }

    public static async getCoordinatesForLocation(location: string) {
        const res = await this.geocoder.geocode(location)
        return res[0] as GeoLocation 
    }

    public static async getLocationForCoordinates(latitude: string, longitude: string) {
        const res = await this.geocoder.reverse({lat: latitude, lon: longitude})
        return res[0] as GeoLocation
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
