import { EmbedBuilder } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { ArrayUtils } from '../../utils/arrayUtils'
import { RandomUtils } from '../../utils/randomUtils'

interface dropCoordinate {
    xDropCoordinate: number
    yDropCoordinate: number
}
interface dropLocation {
    coord: string[]
    name: string
}
export interface CodStats {
    kills: number
    deaths: number
    kdRatio: number
    killsPerGame: number
    damageDone: number
    damageTaken: number | string
    damageDoneTakenRatio: number
    headshotPercentage: number
    gulagDeaths: number
    gulagKills: number
    wallBangs: number
    executions: number
    headshots: number
    matchesPlayed: number
    gulagKd: number
    assists: number
    objectiveMunitionsBoxTeammateUsed: number //Muniton Boxes used
    objectiveBrCacheOpen: number //Chests opened
    objectiveBrKioskBuy: number //Items bought at store
    avgLifeTime: number
    timePlayed: number
    distanceTraveled: number
}
export interface CodBRStats {
    kills: number
    deaths: number
    kdRatio: number
    timePlayed: number
    wins: number
    downs: number
    topTwentyFive: number
    topTen: number
    topFive: number
    contracts: number
    gamesPlayed: number
    winRatio: number
}
export type CodStatsType =
    | 'kills'
    | 'deaths'
    | 'kdRatio'
    | 'killsPerGame'
    | 'damageDone'
    | 'damageTaken'
    | 'damageDoneTakenRatio'
    | 'headshotPercentage'
    | 'gulagDeaths'
    | 'gulagKills'
    | 'gulagKd'
    | 'headshots'
    | 'wallBangs'
    | 'executions'
    | 'objectiveBrKioskBuy'
    | 'assists'
    | 'avgLifeTime'
    | 'objectiveMunitionsBoxTeammateUsed'
    | 'objectiveBrCacheOpen'
    | 'objectiveBrKioskBuy'
    | 'timePlayed'
    | 'matchesPlayed'
    | 'distanceTraveled'

export type CodBRStatsType =
    | 'wins'
    | 'kills'
    | 'deaths'
    | 'kdRatio'
    | 'downs'
    | 'topTwentyFive'
    | 'topTen'
    | 'topFive'
    | 'contracts'
    | 'timePlayed'
    | 'gamesPlayed'
    | 'winRatio'

function getValidDropCoordinate(xCircleCenter: number, yCircleCenter: number): dropCoordinate {
    // -2
    const width: number = RandomUtils.getUnsecureRandomInteger(-3, 3)
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

    const height: number = RandomUtils.getUnsecureRandomInteger(-heightToTravel, heightToTravel)
    // yCoordinate + 1 eller - 1
    const yCoordinate = yCircleCenter + height

    if (isIllegal(xCoordinate, yCoordinate)) {
        return getValidDropCoordinate(xCircleCenter, yCircleCenter)
    }

    return { xDropCoordinate: xCoordinate, yDropCoordinate: yCoordinate }
}

export class CallOfDutyCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async findDropLocation(interaction: ChatInteraction) {
        let mapArray: string[] = []
        let mapName = ''
        await interaction.deferReply()
        const map = interaction.options.get('map')?.value

        if (map === 'verdansk') {
            mapArray = verdansk
            mapName = 'Verdansk'
        } else if (map === 'rebirth') {
            mapArray = rebirthIsland
            mapName = 'Rebirth Island'
        }
        const drop = `${ArrayUtils.randomChoiceFromArray(mapArray)}`
        const emb = new EmbedBuilder().setTitle(drop).setDescription(`Droppunkt for ${mapName}`)
        await this.messageHelper.replyToInteraction(interaction, emb, { hasBeenDefered: true })
    }

    private dropGrid(interaction: ChatInteraction) {
        const gridLetter = 'ABCDEFGHIJ'
        const validNumbers = '2345678'
        const illegalCenterCoordinates = ['A0', 'J0']

        const grid = interaction.options.get('placement')?.value as string
        const letter = grid.charAt(0)
        const gridNumber = parseInt(grid.charAt(1))

        if (!gridLetter.includes(letter.toUpperCase()) || !validNumbers.includes(validNumbers) || grid == '' || Number.isNaN(gridNumber)) {
            this.messageHelper.replyToInteraction(interaction, 'Kan du ikkje i det minsta velga kor sirkelen e?', { ephemeral: true })
        } else if (illegalCenterCoordinates.includes(grid)) {
            this.messageHelper.replyToInteraction(
                interaction,
                'E det sirkelen din? Dokker e fucked... \n(Botten klare ikkje å regna ud koordinater for så små grids)',
                { ephemeral: true }
            )
        } else {
            // E5 = 5,5grid
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
            this.messageHelper.replyToInteraction(
                interaction,
                'Droppunkt for ' + gridLetter[xDropCoordinate] + yDropCoordinate + (dropPlaces ? '\nHer ligger: ' + dropPlaces : '')
            )
        }
    }

    private async findWeeklyPlaylist(interaction: ChatInteraction) {
        const currentPlaylistID = '63da947b0104866d9de5a3cc'
        const pastPlaylistsID = '6570989fdbe452a2875fbc84'
        let foundCurrent = false
        let i = 0
        const now = new Date()
        await interaction.deferReply()

        let currentPlaylistCard = await this.fetchWeeklyTrelloCard(currentPlaylistID, false)
        if (currentPlaylistCard) foundCurrent = true
        if (!currentPlaylistCard) {
            currentPlaylistCard = await this.fetchWeeklyTrelloCard(pastPlaylistsID, true)
        }
        if (!currentPlaylistCard) this.messageHelper.replyToInteraction(interaction, 'Fant ikke playlist', { hasBeenDefered: true })
        else {
            let cardId = currentPlaylistCard.id
            let attachmentId = currentPlaylistCard.idAttachmentCover
            const response = await fetch('https://api.trello.com/1/cards/' + cardId + '/attachments/' + attachmentId)
            const data = await response.json()
            if (foundCurrent) {
                this.messageHelper.replyToInteraction(interaction, data.url, { hasBeenDefered: true })
            } else {
                this.messageHelper.replyToInteraction(
                    interaction,
                    'Fant ikke nåværende playlist. Sender forrige tilgjengelige da den trolig fortsatt er aktiv.',
                    { hasBeenDefered: true }
                )
                this.messageHelper.sendMessage(interaction.channelId, { text: data.url })
            }
        }
    }

    private async fetchWeeklyTrelloCard(trelloList: string, getMostRecent: boolean): Promise<any> {
        let found = false
        let mostRecent = undefined
        let i = 0
        const now = new Date()

        const response = await fetch(`https://api.trello.com/1/lists/${trelloList}/cards`)
        const data = await response.json()
        if (!data) return null
        while (!found && i < data.length) {
            if (data[i].name.toLowerCase().startsWith('weekly playlist')) {
                let start = new Date(data[i].start)
                let end = new Date(data[i].due)
                if (now > start && (!data[i].due || now < end)) {
                    return data[i]
                } else if (getMostRecent) {
                    if (!mostRecent) mostRecent = data[i]
                    let currentEnd = new Date(mostRecent.due)
                    mostRecent = end > currentEnd ? data[i] : mostRecent
                }
            }
            i += 1
        }
        return mostRecent
    }

    public getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'drop',
                        // disabled: true,
                        command: (rawInteraction: ChatInteraction) => {
                            const cmd = rawInteraction.options.getSubcommand()
                            if (cmd === 'poi') this.findDropLocation(rawInteraction)
                            else if (cmd === 'grid') this.dropGrid(rawInteraction)
                        },
                    },
                    {
                        commandName: 'playlist',
                        // disabled: true,
                        command: (rawInteraction: ChatInteraction) => {
                            this.findWeeklyPlaylist(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [],
            },
        }
    }
}

export const rebirthIsland = [
    'Bioweapons Labs',
    'Headquarters',
    'Security Area',
    'Chemical Eng.',
    'Prison Block',
    'Harbor',
    'Decon Zone',
    'Shore',
    'Control Center',
    'Factory',
    'Living Quarters',

    'en plass squad leader bestemmer',
]

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
