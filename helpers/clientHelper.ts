import { Client, ExcludeEnum } from 'discord.js'
import { ActivityTypes } from 'discord.js/typings/enums'
import { DatabaseHelper } from './databaseHelper'

export class ClientHelper {
    static updateStatus(client: Client, type: ExcludeEnum<typeof ActivityTypes, 'CUSTOM'>, status: string) {
        client.user?.setPresence({
            activities: [
                {
                    type: type,
                    name: status,
                },
            ],
            afk: false,
            status: 'online',
        })
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
