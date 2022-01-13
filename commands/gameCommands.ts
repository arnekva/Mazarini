import { Message, MessageEmbed } from 'discord.js'
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

    static GameCommands: ICommandElement[] = [
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
