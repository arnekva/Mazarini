import { Client, ExcludeEnum } from 'discord.js'
import { ActivityTypes } from 'discord.js/typings/enums'
import { DatabaseHelper } from './databaseHelper'

export class ClientHelper {
    static updatePresence(client: Client, type: ExcludeEnum<typeof ActivityTypes, 'CUSTOM'>, status: string, twitchUrl?: string) {
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

    static setStatusFromStorage(client: Client) {
        const status = DatabaseHelper.getBotData('status') ?? 'Kaptein Sabeltann'
        const activityType: ExcludeEnum<typeof ActivityTypes, 'CUSTOM'> = DatabaseHelper.getBotData('statusType') ?? 'WATCHING'
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
