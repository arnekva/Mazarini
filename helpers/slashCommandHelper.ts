import { CacheType, Interaction, InteractionType } from 'discord.js'
import { MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'

// const { REST } = require('@discordjs/rest')
// const { Routes } = require('discord-api-types/v9')
// const { SlashCommandBuilder } = require('@discordjs/builders')
type expectedType = 'string' | 'number' | 'boolean' | 'role' | 'user' | 'channel' | 'attachment'
export class SlashCommandHelper {
    static async buildCommands() {}

    static handleInteractionParameterError(interaction: Interaction<CacheType>) {
        if (interaction.type === InteractionType.ApplicationCommand) {
            if (interaction.replied) {
                interaction.editReply('En feil har oppstått.' + MentionUtils.mentionRole(UserUtils.ROLE_IDs.BOT_SUPPORT))
            }
            interaction.reply('En feil har oppstått.' + MentionUtils.mentionRole(UserUtils.ROLE_IDs.BOT_SUPPORT))
        }
    }

    static getCleanNumberValue(val: any | undefined): number | undefined {
        if (val) {
            const commaToDot = val.toString().replace(',', '.')
            const num = Number(commaToDot).toFixed(0)
            return Number(num)
        }
        return val
    }
}
