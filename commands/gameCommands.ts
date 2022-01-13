import { Message, MessageEmbed } from 'discord.js'
import { env } from 'process'
import { environment } from '../client-env'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { getRndInteger } from '../utils/randomUtils'
import { ICommandElement } from './commands'

interface dropCoordinate {
    xDropCoordinate: number
    yDropCoordinate: number
}
interface dropLocation {
    coord: string[]
    name: string
}

interface rocketLeagueStats {
    modeName?: string
    rank?: string
    division?: string
    iconURL?: string
}
interface rocketLeagueLifetime {
    wins?: string
    goals?: string
    mvp?: string
    saves?: string
    assists?: string
    shots?: string
}
const fetch = require('node-fetch')
const puppeteer = require('puppeteer')
const striptags = require('striptags')
function getValidDropCoordinate(xCircleCenter: number, yCircleCenter: number): dropCoordinate {
    // -2
    const width: number = getRndInteger(-3, 3)
    const isIllegal = (xCoordinate: number, yCoordinate: number) => {
        // A, B, I, J
        const illegalXCoordinates = [0, 1, 8, 9]

        const illegalYCoordinates = [0, 1, 9]
        return (
            illegalXCoordinates.includes(xCoordinate) ||
            illegalYCoordinates.includes(yCoordinate) ||
            xCoordinate < 0 ||
            yCoordinate < 0 ||
            xCoordinate > 9 ||
            yCoordinate > 9
        )
    }

    // 2
    const abs = Math.abs(width)
    const heightToTravel = 3 - abs

    // -2 + 5 = 3, C
    const xCoordinate: number = width + xCircleCenter

    const height: number = getRndInteger(-heightToTravel, heightToTravel)
    // yCoordinate + 1 eller - 1
    const yCoordinate = yCircleCenter + height

    if (isIllegal(xCoordinate, yCoordinate)) {
        return getValidDropCoordinate(xCircleCenter, yCircleCenter)
    }

    return { xDropCoordinate: xCoordinate, yDropCoordinate: yCoordinate }
}

export class GameCommands {
    static dropVerdansk(message: Message) {
        const randomElement = verdansk[Math.floor(Math.random() * verdansk.length)]
        MessageHelper.sendMessage(message, 'Dere dropper i ' + randomElement)
    }

    static dropRebirth(message: Message) {
        const randomElement = rebirthIsland[Math.floor(Math.random() * rebirthIsland.length)]
        MessageHelper.sendMessage(message, 'Dere dropper i ' + randomElement)
    }
    static dropGrid(message: Message, messageContent: string) {
        const gridLetter = 'ABCDEFGHIJ'
        const validNumbers = '2345678'
        const illegalCenterCoordinates = ['A0', 'J0']

        const grid = messageContent.trim()
        const letter = grid.charAt(0)

        const gridNumber = parseInt(grid.charAt(1))

        if (!gridLetter.includes(letter) || !validNumbers.includes(validNumbers) || grid == '' || Number.isNaN(gridNumber)) {
            MessageHelper.sendMessage(message, 'Kan du ikkje i det minsta velga kor sirkelen e?')
            return
        }

        if (illegalCenterCoordinates.includes(grid)) {
            MessageHelper.sendMessage(message, 'E det sirkelen din? Dokker e fucked... \n(Botten klare ikkje å regna ud koordinater for så små grids)')
            return
        }

        // E5 = 5,5
        const xCircleCenter = gridLetter.indexOf(letter)
        const yCircleCenter = gridNumber

        const { xDropCoordinate, yDropCoordinate }: dropCoordinate = getValidDropCoordinate(xCircleCenter, yCircleCenter)
        const dropLoc = gridLetter[xDropCoordinate] + '' + yDropCoordinate + ''
        let dropPlaces = ''
        for (let i = 0; i < dropLocations.length; i++) {
            dropLocations[i].coord.forEach((el) => {
                if (el == dropLoc) dropPlaces += '\n' + dropLocations[i].name
            })
        }
        const train = Math.random() < 0.15
        MessageHelper.sendMessage(message, 'Dere dropper på ' + (train ? 'toget 😲' : gridLetter[xDropCoordinate] + yDropCoordinate))
        if (dropPlaces && !train) MessageHelper.sendMessage(message, 'Her ligger: ' + dropPlaces)
    }

    static async rocketLeagueRanks(rawMessage: Message, messageContent: string, args: string[]) {
        const userValue = DatabaseHelper.getValue('rocketLeagueUserString', rawMessage.author.username, rawMessage, true)
        let user
        if (userValue) user = userValue.split(';')
        if (!user) {
            rawMessage.reply("Du må linke Rocket League kontoen din. Bruk '!mz link rocket <psn|xbl|steam|epic> <brukernavn>'")
            return
        }
        const waitMsg = await MessageHelper.sendMessage(rawMessage, 'Laster data...')
        const name = user[1]
        const platform = user[0]
        const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/${platform}/${name}`
        let browser: any
        if (environment === 'dev') {
            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disabled-setupid-sandbox', '--disable-extensions'],
                executablePath: './node_modules/chromium/lib/chromium/chrome-win/chrome',
                // executablePath: './node_modules/puppeteer/.local-chromium/win64-656675/chrome-win/chrome.exe',
            })
        } else {
            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disabled-setupid-sandbox', '--disable-extensions'],
                executablePath: './node_modules/puppeteer/.local-chromium/linux-938248/chrome-linux/chrome',
                // executablePath: './node_modules/puppeteer/.local-chromium/win64-656675/chrome-win/chrome.exe',
            })
        }

        const page = await browser.newPage()
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36',
        }
        await this.gotoExtended(page, { url: url, method: 'GET', headers: headers })
        const data = await page.content()

        const response = JSON.parse(striptags(data))
        const segments = response.data.segments
        let threeVthree: rocketLeagueStats = {}
        let twoVtwo: rocketLeagueStats = {}
        let lifetimeStats: rocketLeagueLifetime = {}
        if (!segments) {
            MessageHelper.sendMessageToActionLogWithCustomMessage(rawMessage, 'Fetch til Rocket League API feilet', 'Her har noe gått galt', true)
            return
        }
        for (const segment of segments) {
            if (!segment) {
                MessageHelper.sendMessageToActionLogWithCustomMessage(rawMessage, 'Fetch til Rocket League API feilet', 'Her har noe gått galt', true)
                break
            }
            if (segment.metadata.name === 'Lifetime') {
                //Lifetime stats
                lifetimeStats.goals = segment.stats.goals.value
                lifetimeStats.mvp = segment.stats.mVPs.value
                lifetimeStats.assists = segment.stats.assists.value
                lifetimeStats.saves = segment.stats.saves.value
                lifetimeStats.wins = segment.stats.wins.value
                lifetimeStats.shots = segment.stats.shots.value
            } else if (segment.metadata.name === 'Ranked Doubles 2v2') {
                twoVtwo.rank = segment?.stats?.tier?.metadata?.name
                twoVtwo.division = segment?.stats?.division?.metadata?.name
                twoVtwo.modeName = segment?.metadata?.name
                twoVtwo.iconURL = segment.stats?.tier?.metadata?.iconUrl
            } else if (segment.metadata.name === 'Ranked Standard 3v3') {
                threeVthree.rank = segment?.stats?.tier?.metadata?.name
                threeVthree.division = segment?.stats?.division?.metadata?.name
                threeVthree.modeName = segment?.metadata?.name
                threeVthree.iconURL = segment.stats?.tier?.metadata?.iconUrl
            }
        }
        const msgContent = new MessageEmbed().setTitle(`Rocket League - ${name}`)
        if (args[0] === '3v3') {
            msgContent.addField(`${threeVthree.modeName}`, `${threeVthree.rank} ${threeVthree.division}`)
            if (threeVthree.iconURL) msgContent.setThumbnail(threeVthree.iconURL)
        } else if (args[0] === '2v2') {
            msgContent.addField(`${twoVtwo.modeName}`, `${twoVtwo.rank} ${twoVtwo.division}`)
            if (twoVtwo.iconURL) msgContent.setThumbnail(twoVtwo.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
        } else {
            msgContent.addField(`Lifetime stats:`, `${lifetimeStats.goals} mål\n${lifetimeStats.wins} wins\n${lifetimeStats.shots} skudd`)
        }
        if (waitMsg) waitMsg.delete()
        MessageHelper.sendFormattedMessage(rawMessage, msgContent)
    }

    static async gotoExtended(page: any, request: any) {
        const { url, method, headers, postData } = request

        return page.goto(url)
    }

    static GameCommands: ICommandElement[] = [
        {
            commandName: 'rocket',
            description: 'Få Rocket League stats. <2v2|3v3|stats>',
            command: (rawMessage: Message, messageContent: string, args: string[]) => {
                GameCommands.rocketLeagueRanks(rawMessage, messageContent, args)
            },
            category: 'gaming',
        },
        {
            commandName: 'verdansk',
            description: 'Få et tilfeldig sted å droppe i Verdansk',
            command: (rawMessage: Message, messageContent: string) => {
                GameCommands.dropVerdansk(rawMessage)
            },
            category: 'gaming',
        },
        {
            commandName: 'rebirth',
            description: 'Få et tilfeldig sted å droppe i Rebirth Island',
            command: (rawMessage: Message, messageContent: string) => {
                GameCommands.dropRebirth(rawMessage)
            },
            category: 'gaming',
        },
        {
            commandName: 'grid',
            description: 'Få et tilfeldig sted å droppe ut fra Grid i Verdansk',
            command: (rawMessage: Message, messageContent: string) => {
                GameCommands.dropGrid(rawMessage, messageContent)
            },
            category: 'gaming',
        },
    ]
}
export const dropLocations: dropLocation[] = [
    { name: 'Summit', coord: ['C2', 'D2', 'C3'] },
    { name: 'Military Base', coord: ['E2', 'F2'] },
    { name: 'Salt Mine', coord: ['G2', 'H2', 'G3', 'H3'] },
    { name: 'Airport', coord: ['C4', 'D4', 'E4'] },
    { name: 'Storage Town', coord: ['C5'] },
    { name: 'Superstore', coord: ['D5'] },
    { name: 'Factory', coord: ['D5', 'E5'] },
    { name: 'Boneyard', coord: ['C6'] },
    { name: 'Array', coord: ['F4', 'G4'] },
    { name: 'Train Station', coord: ['D6', 'D7', 'E6'] },
    { name: 'Promenade West', coord: ['C7', 'D7', 'E6'] },
    { name: 'Promenade East', coord: ['E7', 'F7'] },
    { name: 'Hills', coord: ['D8', 'E8', 'D7'] },
    { name: 'Park', coord: ['F7', 'F8', 'G7'] },
    { name: 'Hospital', coord: ['E6', 'F6'] },
    { name: 'Downtown', coord: ['F5', 'F6', 'F7', 'G7', 'G6'] },
    { name: 'Stadium', coord: ['G5'] },
    { name: 'Port', coord: ['G7', 'G8', 'H7'] },
    { name: 'Lumber', coord: ['H5', 'H7'] },
    { name: 'Prison', coord: ['H8', 'I8'] },
]
export const verdansk = [
    'Summit',
    'Military Base',
    'Salt Mine',
    'Airport',
    'TV Station',
    'Lumber',
    'Stadium',
    'Downtown',
    'Farmland',
    'Prison',
    'Park',
    'Hills',
    'Hospital',
    'Train Station',
    'Promenade East',
    'Promenade West',
    'Boneyard',
    'Storage Town',
    'Superstore',
    'en plass squad leader bestemmer',
    'Array',
]

export const rebirthIsland = [
    'Bioweapons Labs',
    'Decon Zone',
    'Shore',
    'Construction Site',
    'Headquarters',
    'Chemical Eng.',
    'Prison Block',
    'Harbor',
    'Factory',
    'Living Quarters',
    'Security Area',
    'en plass squad leader bestemmer',
]
