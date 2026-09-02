import { ActivityType, Client } from 'discord.js'
import { DatabaseHelper } from './databaseHelper'

export class ClientHelper {
    static updatePresence(client: Client, type: Exclude<ActivityType, ActivityType.Custom>, status: string, twitchUrl?: string, state?: string) {
        try {
            client.user?.setActivity({
                type: type,
                name: status,
                url: twitchUrl,
                state: state || undefined,
            })
            client.user?.setPresence({
                afk: false,
                status: 'online',
            })
        } catch (error) {
            console.log(error)
        }
    }

    /** Changes the Bots nickname depending on it's status */
    static setDisplayNameMode(client: Client, type: 'offline' | 'online') {
        client.guilds.cache.forEach((guild) => {
            guild.members.me.setNickname(`${type === 'offline' ? '[RESTARTING] ' : ''}Bot Høie`)
        })
    }

    static async setStatusFromStorage(client: Client, dbHelper: DatabaseHelper) {
        const status = (await dbHelper.getBotData('status')) ?? 'Kaptein Sabeltann'
        const activityType: Exclude<ActivityType, ActivityType.Custom> = (await dbHelper.getBotData('statusType')) ?? 'WATCHING'
        const state = (await dbHelper.getBotData('statusState', true)) as string
        client.user?.setPresence({
            activities: [
                {
                    type: activityType,
                    name: status,
                    state: state || undefined,
                },
            ],

            afk: false,
            status: 'online',
        })
    }
}
