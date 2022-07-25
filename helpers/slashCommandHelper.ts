import { CacheType, Interaction, InteractionType } from 'discord.js'
import { MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'

// const { REST } = require('@discordjs/rest')
// const { Routes } = require('discord-api-types/v9')
// const { SlashCommandBuilder } = require('@discordjs/builders')
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
}
