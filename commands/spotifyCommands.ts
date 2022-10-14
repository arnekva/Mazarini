import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, Interaction, Message, User } from 'discord.js'
import { Headers } from 'node-fetch'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { spotifyClientID, spotifyClientSecret } from '../client-env'
import { ICommandElement, IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
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

    /** Authorize app
     *  @returns Access Token for API
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

    private async printSongFromSpotify(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        let searchString = interaction.options.get('tittel')?.value as string
        let debugMode = false
        if (searchString.includes('debug')) {
            searchString = searchString.replace('debug', '')
            debugMode = true
        }

        const data = await this.searchForSongOnSpotifyAPI(searchString)

        if (data) {
            const firstResult = data.body.tracks.items[0]

            const result = `${firstResult?.name} av ${firstResult?.artists[0]?.name}. Utgitt ${firstResult?.album?.release_date}. ${
                firstResult?.external_urls?.spotify
            } ${
                debugMode
                    ? '\n*DEBUG*: Funnet med søk på ' +
                      searchString +
                      ' Andre resultat var ' +
                      data?.body?.tracks?.items[1]?.name +
                      ' av ' +
                      data?.body?.tracks?.items[1]?.artists[0].name
                    : ''
            }`
            this.messageHelper.replyToInteraction(interaction, result, false, true)
        }
    }

    private async currentPlayingFromDiscord(interaction: Interaction<CacheType>, mode?: string, user?: User): Promise<string | EmbedBuilder> {
        const _music = new Music(this.client, this.messageHelper)

        const isAllActive = mode === 'active'
        const isFull = mode === 'full'
        const emoji = await EmojiHelper.getEmoji('catJAM', interaction)
        if (isAllActive) {
            let replyString = ''
            interaction?.guild?.members?.cache?.forEach((localMember) => {
                if (localMember?.presence)
                    localMember.presence.activities.forEach((activity) => {
                        if (activity.name === 'Spotify' && activity.state) {
                            replyString += activity.state && `(${localMember.user.username}) ${activity.state} - ${activity.details} ${emoji?.id ?? ''}\n`
                        }
                    })
            })

            if (replyString.length === 0) replyString = 'Ingen hører på Spotify for øyeblikket'
            return replyString
        }

        if (isFull) {
            let musicRet = ''
            const users = interaction?.guild?.members?.cache.map((u) => {
                return {
                    id: u.user.id,
                    name: u.user.username,
                }
            })
            if (users) {
                for (let i = 0; i < users.length; i++) {
                    const user = DatabaseHelper.getUser(users[i].id)
                    const lastFmName = user?.lastFMUsername

                    if (lastFmName) {
                        musicRet += await _music.findLastFmData({
                            user: lastFmName,
                            includeNameInOutput: true,
                            includeStats: false,
                            limit: '1',
                            method: { cmd: _music.getCommand('siste', '1'), desc: 'Siste 1' },
                            silent: false,
                            username: users[i].name,
                            header: '',
                        })
                    }
                }
                if (musicRet.length < 1) musicRet = 'Fant ingen data'
                return musicRet
            } else return 'Ingen data funnet'
        }

        const member = UserUtils.findMemberByUserID(user ? user.id : interaction.user.id, interaction)
        if (member && member.presence && member.presence.activities.find((a) => a.name === 'Spotify')) {
            const spotify = member.presence.activities.filter((a) => a.name === 'Spotify')[0]
            if (spotify?.state && spotify.details) {
                const data = await this.searchForSongOnSpotifyAPI(spotify.details, spotify.state)
                const items = data.body.tracks.items
                let foundItem: any
                let i = 0
                while (i < items.length) {
                    if (
                        items[i].artists.filter((a) => {
                            console.log(a.name, spotify.state)

                            return a.name === spotify.state
                        }).length
                    ) {
                        foundItem = items[i]
                        i = items.length
                    } else {
                        i++
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${user ? `${user.username} hører på: ` : ''}${spotify?.details} `)
                    .setDescription(`${spotify?.state}`)
                if (foundItem) {
                    embed
                        .addFields({ name: 'Album', value: foundItem.album?.name ?? 'Ukjent', inline: true })
                        .addFields({ name: 'Utgitt', value: foundItem.album?.release_date ?? 'Ukjent', inline: true })
                    if (foundItem.album?.external_urls?.spotify) embed.setURL(foundItem.album?.external_urls?.spotify ?? '#')

                    if (foundItem.album?.images[0]?.url) embed.setThumbnail(foundItem.album.images[0].url)
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
                    header: '',
                })

                return (user ? `*${user.username}:* ` : '') + lastFMData.join(' ') ?? `${user} hører ikke på Spotify nå, og har heller ikke koblet til Last.fm`
            }
        }
        return `${user} hører ikke på Spotify nå, og har heller ikke koblet til Last.fm`
    }

    private async handleSpotifyInteractions(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            await interaction.deferReply() //Må defere reply siden botter har maks 3 sekund å svare på en interaction
            const mode = interaction.options.get('mode')?.value as string
            const user = interaction.options.get('user')?.user
            const data = await this.currentPlayingFromDiscord(interaction, mode, user instanceof User ? user : undefined)

            if (data instanceof EmbedBuilder) {
                interaction.editReply({ embeds: [data] })
            } else {
                interaction.editReply(data)
            }
        }
    }

    public getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'spotify',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.handleSpotifyInteractions(rawInteraction)
                },
                category: 'musikk',
            },
            {
                commandName: 'sang',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.printSongFromSpotify(rawInteraction)
                },
                category: 'musikk',
            },
        ]
    }
}
