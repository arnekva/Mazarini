import { ButtonInteraction, CacheType, Client, Interaction } from 'discord.js'
import { MessageHelper } from '../helpers/messageHelper'
import { UserUtils } from '../utils/userUtils'

export class ButtonHandler {
    private client: Client
    private messageHelper: MessageHelper

    static USER_ROLE_ID = 'UserRoleId_'
    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
    }

    handleIncomingButtonInteraction(interaction: Interaction<CacheType>) {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith(ButtonHandler.USER_ROLE_ID)) {
                this.handleAssignmentOfRoles(interaction)
            }

            return true
        }
        return false
    }

    private handleAssignmentOfRoles(interaction: ButtonInteraction<CacheType>) {
        const roleId = interaction.customId.replace(ButtonHandler.USER_ROLE_ID, '')
        const role = interaction.guild?.roles?.cache.find((r) => r.id === roleId)
        if (roleId && role) {
            const userAsMember = UserUtils.findMemberByUserID(interaction.user.id, interaction)
            userAsMember.roles.add(role)
            this.messageHelper.replyToInteraction(interaction, `Du har nå fått tildelt rollen ${role.name}`, true)
        }
    }
}
