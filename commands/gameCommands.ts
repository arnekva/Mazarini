import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { environment } from '../client-env'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { RandomUtils } from '../utils/randomUtils'
import { SoundUtils } from '../utils/soundUtils'
import { UserUtils } from '../utils/userUtils'

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
    mmr?: string
}
interface rocketLeagueLifetime {
    wins?: string
    goals?: string
    mvp?: string
    saves?: string
    assists?: string
    shots?: string
    goalShotRatio?: string
}
interface rocketLeagueMMR {
    mmr1v1?: string
    mmr2v2?: string
    mmr3v3?: string
}
export interface rocketLeagueDbData {
    stats: rocketLeagueLifetime
    mmr: rocketLeagueMMR
}
const emptyStats: rocketLeagueDbData = {
    stats: { wins: '0', goals: '0', mvp: '0', saves: '0', assists: '0', shots: '0', goalShotRatio: '0' },
    mmr: { mmr1v1: '0', mmr2v2: '0', mmr3v3: '0' },
}
const fetch = require('node-fetch')
const striptags = require('striptags')
const puppeteer = require('puppeteer')
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

export class GameCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async findDropLocation(interaction: ChatInputCommandInteraction<CacheType>) {
        let mapArray: string[] = []
        let mapName = ''
        await interaction.deferReply()
        const map = interaction.options.get('map')?.value

        if (map === 'almazrah') {
            mapArray = alMazrah
            mapName = 'Al Mazrah'
        } else if (map === 'caldera') {
            mapArray = calderaPoints
            mapName = 'Caldera'
        } else if (map === 'rebirth') {
            mapArray = rebirthIsland
            mapName = 'Rebirth Island'
        } else if (map === 'fortune') {
            mapArray = fortunesKeep
            mapName = "Fortune's Keep"
        }
        const drop = `${ArrayUtils.randomChoiceFromArray(mapArray)}`
        const emb = new EmbedBuilder().setTitle(drop).setDescription(`Droppunkt for ${mapName}`)
        await this.messageHelper.replyToInteraction(interaction, emb, { hasBeenDefered: true })

        const memb = UserUtils.findMemberByUserID(interaction.user.id, interaction)
        if (memb?.voice?.channel) {
            await SoundUtils.connectToVoiceAndSpeak(
                {
                    adapterCreator: interaction.guild?.voiceAdapterCreator,
                    channelID: memb.voice?.channelId ?? 'None',
                    guildID: interaction?.guildId ?? 'None',
                },
                `For ${mapName}, you are dropping in ${drop}`
            )
        }
    }

    private dropGrid(interaction: ChatInputCommandInteraction<CacheType>) {
        const gridLetter = 'ABCDEFGHIJ'
        const validNumbers = '2345678'
        const illegalCenterCoordinates = ['A0', 'J0']

        const grid = interaction.options.get('placement')?.value as string
        const letter = grid.charAt(0)
        const gridNumber = parseInt(grid.charAt(1))

        if (!gridLetter.includes(letter) || !validNumbers.includes(validNumbers) || grid == '' || Number.isNaN(gridNumber)) {
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

    private async rocketLeagueRanks(interaction: ChatInputCommandInteraction<CacheType>) {
        const userValue = DatabaseHelper.getUser(interaction.user.id).rocketLeagueUserString
        let user
        if (userValue) user = userValue.split(';')

        // return
        if (!user) {
            return this.messageHelper.replyToInteraction(
                interaction,
                "Du må linke Rocket League kontoen din. Bruk '/link rocket <psn|xbl|steam|epic> <brukernavn>'"
            )
        }
        await interaction.deferReply()
        const platform = user[0]
        const name = user[1]
        const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/${platform}/${name}`

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36',
        }

        //Need to specify executable path on Raspberry Pi, as it for some reason doesn't like the Puppeteer-supplied chromium version. Should work on Windows/Mac.
        let browser
        if (environment === 'prod')
            browser = await puppeteer.launch({
                headless: true,
                executablePath: '/usr/bin/chromium-browser',
            })
        else
            browser = await puppeteer.launch({
                headless: true,
            })
        const page = await browser.newPage()
        page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36')
        await page.goto(url)
        const content = await page.content()

        await browser.close()
        const contentString = content as string
        if (contentString.includes('Access denied')) {
            interaction.editReply(`Access denied.`)
            this.messageHelper.sendLogMessage(
                `api.tracker.gg for Rocket League gir Access Denied. Melding stammer fra ${interaction.user.username} i ${
                    (interaction?.channel as TextChannel).name
                }`
            )
        }

        const response = JSON.parse(striptags(content))
        if (!response.data) {
            interaction.editReply('Fant ikke data')
        }
        const segments = response.data.segments

        let threeVthree: rocketLeagueStats = {}
        let twoVtwo: rocketLeagueStats = {}
        let oneVone: rocketLeagueStats = {}
        let lifetimeStats: rocketLeagueLifetime = {}
        if (!segments) {
            interaction.editReply('Fetch til Rocket League API feilet')
        }
        for (const segment of segments) {
            if (!segment) {
                interaction.editReply('Fetch til Rocket League API feilet')
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
                lifetimeStats.goalShotRatio = Number(segment.stats.goalShotRatio.value).toFixed(2)
            } else if (segment.metadata.name === 'Ranked Duel 1v1') {
                oneVone.rank = segment?.stats?.tier?.metadata?.name
                oneVone.division = segment?.stats?.division?.metadata?.name
                oneVone.modeName = segment?.metadata?.name
                oneVone.iconURL = segment.stats?.tier?.metadata?.iconUrl
                oneVone.mmr = segment?.stats?.rating?.value
            } else if (segment.metadata.name === 'Ranked Doubles 2v2') {
                twoVtwo.rank = segment?.stats?.tier?.metadata?.name
                twoVtwo.division = segment?.stats?.division?.metadata?.name
                twoVtwo.modeName = segment?.metadata?.name
                twoVtwo.iconURL = segment.stats?.tier?.metadata?.iconUrl
                twoVtwo.mmr = segment?.stats?.rating?.value
            } else if (segment.metadata.name === 'Ranked Standard 3v3') {
                threeVthree.rank = segment?.stats?.tier?.metadata?.name
                threeVthree.division = segment?.stats?.division?.metadata?.name
                threeVthree.modeName = segment?.metadata?.name
                threeVthree.iconURL = segment.stats?.tier?.metadata?.iconUrl
                threeVthree.mmr = segment?.stats?.rating?.value
            }
        }
        let userData = this.getUserStats(interaction)
        let mmrDiff = ''
        const msgContent = new EmbedBuilder().setTitle(`Rocket League - ${name}`)
        const statsType = interaction.options.get('modus')?.value as string
        if (statsType === '3v3') {
            mmrDiff = this.compareOldNewStats(threeVthree.mmr, userData.mmr?.mmr3v3, false)
            msgContent.addFields([{ name: `${threeVthree.modeName}`, value: `${threeVthree.rank} ${threeVthree.division}\n${threeVthree.mmr} MMR ${mmrDiff}` }])
            if (threeVthree.iconURL) msgContent.setThumbnail(threeVthree.iconURL)
            userData.mmr.mmr3v3 = threeVthree.mmr
        } else if (statsType === '2v2') {
            mmrDiff = this.compareOldNewStats(twoVtwo.mmr, userData.mmr?.mmr2v2, false)
            msgContent.addFields([{ name: `${twoVtwo.modeName}`, value: `${twoVtwo.rank} ${twoVtwo.division}\n${twoVtwo.mmr} MMR ${mmrDiff}` }])
            if (twoVtwo.iconURL) msgContent.setThumbnail(twoVtwo.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
            userData.mmr.mmr2v2 = twoVtwo.mmr
        } else if (statsType === '1v1') {
            mmrDiff = this.compareOldNewStats(oneVone.mmr, userData.mmr?.mmr1v1, false)
            msgContent.addFields([{ name: `${oneVone.modeName}`, value: `${oneVone.rank} ${oneVone.division}\n${oneVone.mmr} MMR ${mmrDiff}` }])
            if (oneVone.iconURL) msgContent.setThumbnail(oneVone.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
            userData.mmr.mmr1v1 = oneVone.mmr
        } else {
            const goalDiff = this.compareOldNewStats(lifetimeStats.goals, userData.stats?.goals, false)
            const winDiff = this.compareOldNewStats(lifetimeStats.wins, userData.stats?.wins, false)
            const shotsDiff = this.compareOldNewStats(lifetimeStats.shots, userData.stats?.shots, false)
            const savesDiff = this.compareOldNewStats(lifetimeStats.saves, userData.stats?.saves, false)
            const assistsDiff = this.compareOldNewStats(lifetimeStats.assists, userData.stats?.assists, false)
            const goalShotRatioDiff = this.compareOldNewStats(lifetimeStats.goalShotRatio, userData.stats?.goalShotRatio, false)
            msgContent.setDescription('Lifetime stats')
            msgContent.addFields([
                { name: 'Wins', value: lifetimeStats.wins + ' ' + winDiff, inline: true },
                { name: 'Goals', value: lifetimeStats.goals + ' ' + goalDiff, inline: true },
                { name: 'Assists', value: lifetimeStats.assists + ' ' + assistsDiff, inline: true },
                { name: 'Shots', value: lifetimeStats.shots + ' ' + shotsDiff, inline: true },
                { name: 'Saves', value: lifetimeStats.saves + ' ' + savesDiff, inline: true },
                { name: 'Goal/Shot Ratio', value: lifetimeStats.goalShotRatio + '% ' + goalShotRatioDiff, inline: true },
            ])
            userData.stats = lifetimeStats
        }
        this.saveUserStats(interaction, userData)
        interaction.editReply({ embeds: [msgContent] })
        return true
    }

    private compareOldNewStats(current?: string | Number | undefined, storedData?: string | number | undefined, ignoreCompare?: boolean) {
        if (!current || !storedData) return ''
        if (ignoreCompare) return ''
        const currentStats = Number(current)
        const oldStorageStats = Number(storedData)
        const value = currentStats - oldStorageStats
        if (currentStats > oldStorageStats) return ` (+${parseFloat(Number(value).toFixed(2))})`
        if (currentStats < oldStorageStats) return ` (${parseFloat(Number(value).toFixed(2))})`
        return ``
    }

    private saveUserStats(interaction: ChatInputCommandInteraction<CacheType>, stats: rocketLeagueDbData) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        user.rocketLeagueStats = stats
        DatabaseHelper.updateUser(user)
    }

    private getUserStats(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        if (user.rocketLeagueStats === undefined) return emptyStats
        return user.rocketLeagueStats
    }

    public getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'drop',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.findDropLocation(interaction)
                        },
                    },
                    {
                        commandName: 'grid',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.dropGrid(interaction)
                        },
                    },
                    {
                        commandName: 'rocket',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.rocketLeagueRanks(interaction)
                        },
                    },
                ],
            },
        }
    }
}

export const dropLocations: dropLocation[] = [
    { name: 'Arsenal', coord: ['C1', 'D1', 'E1', 'D2'] },
    { name: 'Docks', coord: ['F0', 'G0', 'F1', 'G1'] },
    { name: 'Runway', coord: ['I1', 'H1', 'I2', 'H2'] },
    { name: 'Beachhead', coord: ['I2', 'I3', 'H2', 'H3'] },
    { name: 'Peak', coord: ['F3', 'G3', 'G4', 'F4'] },
    { name: 'Mines', coord: ['E2', 'E3', 'E4', 'D3', 'D4'] },
    { name: 'Ruins', coord: ['C2', 'B3', 'C3'] },
    { name: 'Village', coord: ['B3', 'B4', 'C4', 'C5'] },
    { name: 'Fields', coord: ['F5', 'G5', 'H5', 'E6', 'F6', 'G6', 'H5', 'H6'] },
    { name: 'Sub Pen', coord: ['I5', 'I6', 'I7', 'H6'] },
    { name: 'Resort', coord: ['H7', 'I7', 'H8', 'I8'] },
    { name: 'Capital', coord: ['H9', 'G9', 'H8', 'G8', 'F8', 'F9'] },
    { name: 'Power Plant', coord: ['D7', 'E7', 'F7', 'D8', 'E8', 'F8'] },
    { name: 'Airfield', coord: ['D5', 'C6', 'C7', 'D6', 'D7', 'E6'] },
    { name: 'Lagoon', coord: ['B5', 'B6', 'C6', 'C5'] },
]
export const calderaPoints = [
    'Arsenal',
    'Beachhead',
    'Peak',
    'Fields',
    'Sub Pen',
    'Resort',
    'Docks',
    'Runway',
    'Capital',
    'Power Plant',
    'Airfield',
    'Peak (men ikkje den sidetunnelen)',
    'Mines',
    'Ruins',
    'Village',
    'Lagoon',
    'Storage Town',
    'en plass squad leader bestemmer',
]

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
export const fortunesKeep = [
    'Lighthouse',
    'Town',
    'Overlook',
    'en plass squad leader bestemmer',
    'Terraces',
    'Gatehouse',
    'Grotto',
    'Keep',
    'Winery',
    'Camp',
    "Smuggler's Cove",
    'Bay',
    'Graveyard',
]

export const alMazrah = [
    'Oasis',
    'Taraq Village',
    'Rohan Oil',
    'Quarry',
    'Port',
    'Hydroelectric',
    'Al Mazrah City',
    'Caves',
    "Sa'id City",
    'Sawah Village',
    'Sarrif Bay',
    'Fortress',
    'Airport',
    'Ahkdar Village',
    'Observatory',
    'Marshlands',
    'Al Sharim Pass',
]
