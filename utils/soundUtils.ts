import { getVoiceConnection } from '@discordjs/voice'
import { environment } from '../client-env'

const say = require('say')
const { joinVoiceChannel } = require('@discordjs/voice')
const exec = require('child_process').exec

interface IVoiceConnectParams {
    channelID: string
    guildID: string
    adapterCreator: any //TODO: Type this
}
export class SoundUtils {
    static speakText(text: string) {
        if (environment === 'prod') {
            SoundUtils.speakOnLinux(text)
        } else {
            say.speak(text)
        }
    }

    static speakOnLinux(text: string) {
        exec('echo ' + text)
    }

    static stopCurrentSay() {
        say.stop()
    }

    static connectToVoiceAndSpeak(params: IVoiceConnectParams, text: string) {
        const connection = joinVoiceChannel({
            channelId: params.channelID,
            guildId: params.guildID,
            adapterCreator: params.adapterCreator,
        })
        SoundUtils.speakText(text)
    }

    static disconnectFromVoiceChannel(guildID: string) {
        const connection = getVoiceConnection(guildID)
        connection.destroy()
    }
}
