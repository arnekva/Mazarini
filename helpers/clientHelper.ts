import { ActivityType, Client } from 'discord.js'
import { DatabaseHelper } from './databaseHelper'

export class ClientHelper {
    static updatePresence(client: Client, type: Exclude<ActivityType, ActivityType.Custom>, status: string, twitchUrl?: string) {
        try {
            client.user?.setActivity({
                type: type,
                name: status,
                url: twitchUrl,
            })
            client.user?.setPresence({
                afk: false,
                status: 'online',
            })
        } catch (error) {
            console.log(error)
        }
    }

    static async setStatusFromStorage(client: Client, dbHelper: DatabaseHelper) {
        const status = await dbHelper.getBotData('status') ?? 'Kaptein Sabeltann'
        const activityType: Exclude<ActivityType, ActivityType.Custom> = await dbHelper.getBotData('statusType') ?? 'WATCHING'
        client.user?.setPresence({
            activities: [
                {
                    type: activityType,
                    name: status,
                },
            ],

            afk: false,
            status: 'online',
        })
    }
}
