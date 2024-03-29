import { MessageHelper } from '../helpers/messageHelper'

const pm2 = require('pm2')
export class ErrorHandler {
    messageHelper: MessageHelper
    constructor(msgHelper: MessageHelper) {
        this.messageHelper = msgHelper
    }

    launchBusListeners() {
        const _msgHelper = this.messageHelper
        pm2.launchBus(function (err: any, bus: any) {
            // Listen for process errors

            bus.on('log:err', function (data: any) {
                if (data?.data?.includes('Unknown interaction')) {
                    _msgHelper.sendLogMessage(`Klarte ikke bruke reply på en interaksjon. Ingen stacktrace vises for Unknown Interaction. (log:err)`)
                } else {
                    _msgHelper.sendLogMessage(
                        'En feilmelding har blitt logget til konsollen (log:err) \n**Melding:** ' +
                            `\n**Message**: ${data?.data ?? 'NONE'}\n**Unix timestamp**: ${data?.at ?? 'NONE'}`
                    )
                }
            })
            // Listen for PM2 kill
            bus.on('pm2:kill', function (data: any) {
                _msgHelper.sendLogMessage('pm2 logget en melding til konsollen. pm2:kill. Melding: ' + data)
            })

            // Listen for process exceptions

            bus.on('process:exception', function (data: any) {
                if (data?.data?.stack?.includes('ENOTFOUND') || data?.data?.stack?.includes('discord.com')) {
                    _msgHelper.sendLogMessage('PM2 logget en feil. Process:exception. Dette er en DISCORD.COM feilmelding: ENOTFOUND.')
                } else if (data?.data?.message?.includes('Unknown interaction')) {
                    _msgHelper.sendLogMessage(
                        'Klarte ikke bruke reply på en interaksjon (Unknown Interaction) (process:exception). En separat melding vil bli sendt for å svare på interaksjonen'
                    )
                } else if (!data?.data?.stack?.includes('fewer in length')) {
                    _msgHelper.sendLogMessage(
                        'pm2 logget en melding til konsollen. Process:exception. Melding: ' +
                            `\n* **Message**: ${data?.data?.message ?? 'NONE'}\n* **Error** name: ${data?.data?.name ?? 'NONE'}\n* **Callsite**: ${
                                data?.data?.callsite ?? 'NONE'
                            }\n* **Context**: ${data?.data?.context ?? 'NONE'}\n* **Stacktrace**: ${data?.data?.stack ?? 'NONE'}`
                    )
                }
            })
        })
    }
}
