// const { REST } = require('@discordjs/rest')
// const { Routes } = require('discord-api-types/v9')
// const { SlashCommandBuilder } = require('@discordjs/builders')
type expectedType = 'string' | 'number' | 'boolean' | 'role' | 'user' | 'channel' | 'attachment'
export class SlashCommandHelper {
    static getCleanNumberValue(val: any | undefined): number | undefined {
        if (val) {
            const commaToDot = val.toString().replace(',', '.')
            const num = Number(commaToDot).toFixed(0)
            return Number(num)
        }
        return val
    }
}
