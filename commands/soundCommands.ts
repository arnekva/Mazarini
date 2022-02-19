import { createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice'
import { Client, Message, VoiceChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'

const say = require('say')
const FS = require('fs')
const voice = require('@discordjs/voice')

export class SoundCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private disconnectBot(message: Message, messageContent: string) {
        voice.getVoiceConnection(message.guild?.id)?.disconnect()
    }

    private connectToVoiceChannel(message: Message, messageContent: string) {
        const channel = message?.member?.voice?.channelId
        if (!channel) {
            message.reply('Du må være koblet til en voice channel for å bruke denne kommandoen')
            return
        }
        const voiceChannel = message.channel.client.channels.cache.get(channel) as VoiceChannel
        const textToSay = messageContent.trim() || `${message.author.username}, you fool, you have to write some text for me to say`

        this.tts(voiceChannel, textToSay, message)
    }
    // @ts-ignore
    private tts(voiceChannel: VoiceChannel, text: string, message: Message) {
        if (!FS.existsSync('./temp')) {
            FS.mkdirSync('./temp')
        }
        const timestamp = new Date().getTime()
        const soundPath = `./temp/${timestamp}.wav`
        try {
            say.export(text, null, 1, soundPath, (err: any) => {
                if (err) {
                    console.error(err)
                    return
                } else {
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                        guildId: voiceChannel.guild.id,
                    })
                    const player = createAudioPlayer()
                    const resource = createAudioResource(soundPath)
                    player.play(resource)
                    connection.subscribe(player)

                    player.on('stateChange', (oldState, newState) => {
                        if (oldState.status === 'playing' && newState.status === 'idle') {
                            FS.unlinkSync(soundPath)
                            //Den burde disconnecte av seg selv etter ca. 2 minutter uten aktivitet
                            // connection.disconnect()
                        }
                    })
                }
            })
        } catch (error) {
            message.reply('Error: ' + error)
        }
    }

    getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: ['say', 'si'],
                description: 'Få botten til å si noe',
                command: (rawMessage: Message, messageContent: string) => {
                    this.connectToVoiceChannel(rawMessage, messageContent)
                },
                category: 'spin',
            },
            {
                commandName: 'disconnect',
                description: 'Disconnect botten fra voice channelen',
                command: (rawMessage: Message, messageContent: string) => {
                    this.disconnectBot(rawMessage, messageContent)
                },
                category: 'spin',
            },
        ]
    }
}
