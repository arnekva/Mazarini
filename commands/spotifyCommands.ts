import { CacheType, Client, Interaction, Message, MessageEmbed, User } from 'discord.js'
import { Headers } from 'node-fetch'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { spotifyClientID, spotifyClientSecret } from '../client-env'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { SlashCommandHelper } from '../helpers/slashCommandHelper'
import { UserUtils } from '../utils/userUtils'
import { Music } from './musicCommands'
const SpotifyWebApi = require('spotify-web-api-node')
const base64 = require('base-64')
const request = require('request')
const fetch = require('node-fetch')
export class SpotifyCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private getUsersCurrentSong(rawMessage: Message, content: string, args: string[]) {
        const user = args[0] ?? undefined

        const url = `https://api.spotify.com/v1/search?type=track&include_external=audio`
        const _msg = this.messageHelper
        request(
            {
                url: url,
                headers: {
                    Authorization: 'Bearer ' + spotifyClientID,
                },
                rejectUnauthorized: false,
            },
            function (err: any, res: any) {
                if (err) {
                    rawMessage.reply('Fant ingen Spotify-bruker ved navn <' + user + '>')
                } else {
                    _msg.sendMessage(rawMessage.channelId, res)
                }
            }
        )
    }

    /** Autorisere appen hos spotify
     *  @returns Access Token for API-et
     */
    private async authorize() {
        let myHeaders = new Headers()
        myHeaders.append('Authorization', `Basic ${base64.encode(spotifyClientID + ':' + spotifyClientSecret)}`)
        myHeaders.append('Content-Type', 'application/x-www-form-urlencoded')

        var urlencoded = new URLSearchParams()
        urlencoded.append('grant_type', 'client_credentials')

        const requestOptions = {
            method: 'POST',
            headers: myHeaders,
            body: urlencoded,
            redirect: 'follow',
        }

        let res = await fetch('https://accounts.spotify.com/api/token', requestOptions)
        res = await res.json()
        return res.access_token
    }

    cleanSearchString(s: string) {
        let cleanString = s
        if (s.includes(';')) {
            cleanString += cleanString.slice(0, cleanString.indexOf(';'))
        }
        cleanString = cleanString.replace(' -', '')
        return cleanString
    }

    private async searchForSongOnSpotifyAPI(track: string, artist?: string) {
        const _msgHelper = this.messageHelper
        const auth = await this.authorize() //Autoriser appen
        const spotifyApi = new SpotifyWebApi({
            clientId: spotifyClientID,
            clientSecret: spotifyClientSecret,
            redirectUri: 'http://www.example.com/callback',
        })
        spotifyApi.setAccessToken(auth)

        const searchString = artist ? `${track} ${artist}` : track

        return await spotifyApi.searchTracks(searchString)
    }

    private async printSongFromSpotify(message: Message, messageContent: string, args: string[]) {
        const data = await this.searchForSongOnSpotifyAPI(messageContent)
        if (data) {
            const firstResult = data.body.tracks.items[0]

            const result = `${firstResult?.name} av ${firstResult?.artists[0]?.name}. Utgitt ${firstResult?.album?.release_date}. ${firstResult?.external_urls?.spotify}`
            this.messageHelper.sendMessage(message.channelId, result)
        }
    }

    private async currentPlayingFromDiscord(interaction: Interaction<CacheType>, mode?: string, user?: User): Promise<string | MessageEmbed> {
        const _music = new Music(this.client, this.messageHelper)

        const isAllActive = mode === 'active'
        const isFull = mode === 'full'
        const emoji = await EmojiHelper.getEmoji('catJAM', interaction)
        if (isAllActive) {
            let replyString = ''
            interaction.guild.members.cache.forEach((localMember) => {
                if (localMember?.presence)
                    localMember.presence.activities.forEach((activity) => {
                        if (activity.name === 'Spotify') {
                            replyString += `(${localMember.user.username}) ${activity.state} - ${activity.details} ${emoji?.id ?? ''}\n`
                        }
                    })
            })

            if (replyString.length === 0) replyString = 'Ingen hører på Spotify for øyeblikket'
            return replyString
        }

        if (isFull) {
            let musicRet = ''
            const users = interaction.guild.members.cache.map((u) => {
                return {
                    id: u.user.id,
                    name: u.user.username,
                }
            })

            for (let i = 0; i < users.length; i++) {
                const user = DatabaseHelper.getUser(users[i].id)
                const lastFmName = user?.lastFMUsername

                if (lastFmName) {
                    musicRet +=
                        `(${users[i].name}) ` +
                        (await _music.findLastFmData({
                            user: lastFmName,
                            includeNameInOutput: false,
                            includeStats: false,
                            limit: '1',
                            method: { cmd: _music.getCommand('siste', '1'), desc: 'Siste 1' },
                            silent: false,
                            username: users[i].name,
                        }))
                }
            }
            if (musicRet.length < 1) musicRet = 'Fant ingen data'
            return musicRet
        }

        const member = UserUtils.findMemberByUserID(user ? user.id : interaction.user.id, interaction)
        if (member && member.presence && member.presence.activities.find((a) => a.name === 'Spotify')) {
            const spotify = member.presence.activities.filter((a) => a.name === 'Spotify')[0]
            if (spotify?.state && spotify.details) {
                const data = await this.searchForSongOnSpotifyAPI(spotify.details, spotify.state)
                const items = data.body.tracks.items[0]

                const embed = new MessageEmbed()
                    .setTitle(`${user ? `${user.username} hører på: ` : ''}${spotify?.details} `)
                    .setDescription(`${spotify?.state}`)
                if (items) {
                    embed.addField('Album', items.album?.name ?? 'Ukjent', true).addField('Utgitt', items.album?.release_date ?? 'Ukjent', true)
                    if (items.album?.external_urls?.spotify) embed.setURL(items.album?.external_urls?.spotify ?? '#')

                    if (items.album?.images[0]?.url) embed.setThumbnail(items.album.images[0].url)
                }

                return embed
            }
        } else {
            const dbUser = DatabaseHelper.getUser(user?.id ?? interaction.user.id)
            const lastFmName = dbUser.lastFMUsername
            if (lastFmName) {
                const lastFMData = await _music.findLastFmData({
                    user: lastFmName,
                    includeNameInOutput: false,
                    includeStats: false,
                    limit: '1',
                    method: { cmd: _music.getCommand('siste', '10'), desc: 'test' },
                    silent: false,
                    username: dbUser.displayName ?? (user ? user.username : interaction.user.username),
                })

                return (user ? `*${user.username}:* ` : '') + lastFMData.join(' ') ?? `${user} hører ikke på Spotify nå, og har heller ikke koblet til Last.fm`
            }
        }
        return `${user} hører ikke på Spotify nå, og har heller ikke koblet til Last.fm`
    }

    private async handleSpotifyInteractions(rawInteraction: Interaction<CacheType>) {
        const interaction = SlashCommandHelper.getTypedInteraction(rawInteraction)
        if (interaction) {
            await interaction.deferReply() //Må defere reply siden botter har maks 3 sekund å svare på en interaction
            const mode = interaction.options.get('mode')?.value as string
            const user = interaction.options.get('user')?.user
            const data = await this.currentPlayingFromDiscord(interaction, mode, user instanceof User ? user : undefined)

            if (data instanceof MessageEmbed) {
                interaction.editReply({ embeds: [data] })
            } else {
                interaction.editReply(data)
            }
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'spotify',
                description: 'Hent hva brukeren spiller av på Spotify (fra Discord)',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    // this.currentPlayingFromDiscord(rawMessage, messageContent, args)
                },
                category: 'musikk',
                isReplacedWithSlashCommand: 'spotify',
            },
            {
                commandName: 'sang',
                description: 'Søk etter en sang på Spotify. Returnerer første resultat med link',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.printSongFromSpotify(rawMessage, messageContent, args)
                },
                category: 'musikk',
            },
        ]
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'spotify',
                command: (rawInteraction: Interaction<CacheType>) => {
                    this.handleSpotifyInteractions(rawInteraction)
                },
                category: 'musikk',
            },
        ]
    }
}
