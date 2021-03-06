import { CacheType, ChatInputCommandInteraction, Client, CommandInteraction, EmbedBuilder, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { environment } from '../client-env'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { RandomUtils } from '../utils/randomUtils'
import { TextUtils } from '../utils/textUtils'
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
}
const fetch = require('node-fetch')
const striptags = require('striptags')
const puppeteer = require('puppeteer')
function getValidDropCoordinate(xCircleCenter: number, yCircleCenter: number): dropCoordinate {
    // -2
    const width: number = RandomUtils.getRndInteger(-3, 3)
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

    const height: number = RandomUtils.getRndInteger(-heightToTravel, heightToTravel)
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
        let mapArray = []
        let mapName = ''

        const map = interaction.options.get('map').value

        if (map === 'caldera') {
            mapArray = calderaPoints
            mapName = 'Caldera'
        } else if (map === 'rebirth') {
            mapArray = rebirthIsland
            mapName = 'Rebirth Island'
        } else if (map === 'fortune') {
            mapArray = fortunesKeep
            mapName = "Fortune's Keep"
        }

        const commandInteraction = interaction as CommandInteraction
        await commandInteraction.reply(`Dere dropper i ${ArrayUtils.randomChoiceFromArray(mapArray)} (${mapName})`)
    }

    private dropGrid(message: Message, messageContent: string) {
        const gridLetter = 'ABCDEFGHIJ'
        const validNumbers = '2345678'
        const illegalCenterCoordinates = ['A0', 'J0']

        const grid = messageContent.trim()
        const letter = grid.charAt(0)

        const gridNumber = parseInt(grid.charAt(1))

        if (!gridLetter.includes(letter) || !validNumbers.includes(validNumbers) || grid == '' || Number.isNaN(gridNumber)) {
            this.messageHelper.sendMessage(message.channelId, 'Kan du ikkje i det minsta velga kor sirkelen e?')
        } else if (illegalCenterCoordinates.includes(grid)) {
            this.messageHelper.sendMessage(
                message.channelId,
                'E det sirkelen din? Dokker e fucked... \n(Botten klare ikkje ?? regna ud koordinater for s?? sm?? grids)'
            )
        } else {
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

            this.messageHelper.sendMessage(message.channelId, 'Dere dropper p?? ' + gridLetter[xDropCoordinate] + yDropCoordinate)
            if (dropPlaces) this.messageHelper.sendMessage(message.channelId, 'Her ligger: ' + dropPlaces)
        }
    }

    private async rocketLeagueRanks(rawMessage: Message, messageContent: string, args: string[]) {
        const _user = UserUtils.findUserByUsername(TextUtils.splitUsername(args[1]), rawMessage)

        const userValue = _user ? DatabaseHelper.getUser(_user.id).rocketLeagueUserString : DatabaseHelper.getUser(rawMessage.author.id).rocketLeagueUserString
        let user
        if (userValue) user = userValue.split(';')

        // return
        if (!user) {
            return rawMessage.reply("Du m?? linke Rocket League kontoen din. Bruk '!mz link rocket <psn|xbl|steam|epic> <brukernavn>'")
        }
        const waitMsg = await this.messageHelper.sendMessage(rawMessage.channelId, 'Laster data...')
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
            this.messageHelper.sendMessage(rawMessage.channelId, `Access denied.`)
            this.messageHelper.sendMessageToActionLog(
                rawMessage.channel as TextChannel,
                `api.tracker.gg for Rocket League gir Access Denied. Melding stammer fra ${rawMessage.author.username} i ${
                    (rawMessage.channel as TextChannel).name
                }`
            )
            if (waitMsg) waitMsg.delete()
        }

        const response = JSON.parse(striptags(content))
        if (!response.data) {
            return this.messageHelper.sendMessageToActionLogWithCustomMessage(
                rawMessage,
                'Fant ikke data',
                'Fant ikke data for brukeren. Her har en error skjedd',
                true
            )
        }
        const segments = response.data.segments

        let threeVthree: rocketLeagueStats = {}
        let twoVtwo: rocketLeagueStats = {}
        let oneVone: rocketLeagueStats = {}
        let lifetimeStats: rocketLeagueLifetime = {}
        if (!segments) {
            return this.messageHelper.sendMessageToActionLogWithCustomMessage(rawMessage, 'Fetch til Rocket League API feilet', 'Her har noe g??tt galt', false)
        }
        for (const segment of segments) {
            if (!segment) {
                this.messageHelper.sendMessageToActionLogWithCustomMessage(rawMessage, 'Fetch til Rocket League API feilet', 'Her har noe g??tt galt', true)
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
        const msgContent = new EmbedBuilder().setTitle(`Rocket League - ${name}`)
        if (args[0] === '3v3') {
            msgContent.addFields([{ name: `${threeVthree.modeName}`, value: `${threeVthree.rank} ${threeVthree.division} (${threeVthree.mmr})` }])
            if (threeVthree.iconURL) msgContent.setThumbnail(threeVthree.iconURL)
        } else if (args[0] === '2v2') {
            msgContent.addFields([{ name: `${twoVtwo.modeName}`, value: `${twoVtwo.rank} ${twoVtwo.division} (${twoVtwo.mmr})` }])
            if (twoVtwo.iconURL) msgContent.setThumbnail(twoVtwo.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
        } else if (args[0] === '1v1') {
            msgContent.addFields([{ name: `${oneVone.modeName}`, value: `${oneVone.rank} ${oneVone.division} (${oneVone.mmr})` }])
            if (oneVone.iconURL) msgContent.setThumbnail(oneVone.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
        } else {
            msgContent.addFields([{ name: `Lifetime stats:`, value: `${lifetimeStats.goals} m??l\n${lifetimeStats.wins} wins\n${lifetimeStats.shots} skudd` }])
        }
        if (waitMsg) waitMsg.delete()

        this.messageHelper.sendFormattedMessage(rawMessage.channel as TextChannel, msgContent)
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'rocket',
                description: 'F?? Rocket League stats. <2v2|3v3|stats>',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    rawMessage.reply('Denne funksjonen er midlertidig skrudd av grunnet Puppeteer-kr??ll')
                },
                category: 'gaming',
            },

            {
                commandName: 'grid',
                description: 'F?? et tilfeldig sted ?? droppe ut fra Grid i Verdansk',
                command: (rawMessage: Message, messageContent: string) => {
                    this.dropGrid(rawMessage, messageContent)
                },
                category: 'gaming',
            },
            {
                commandName: ['fortune', 'caldera', 'rebirth'],
                description: 'Deprecated, bruk slash-command i stedet',
                command: (rawMessage: Message, messageContent: string) => {
                    rawMessage.reply('Denne commanden er deprecated. Bruk /drop i stedet')
                },
                category: 'gaming',
            },
        ]
    }
    public getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'drop',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.findDropLocation(interaction)
                },
                category: 'gaming',
            },
        ]
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
