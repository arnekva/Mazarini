import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Message,
    SelectMenuComponentOptionData,
} from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { ButtonHandler } from '../handlers/buttonHandler'
import { SelectMenuHandler } from '../handlers/selectMenuHandler'
import { ActionMenuHelper } from '../helpers/actionMenuHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { EmbedUtils } from '../utils/embedUtils'
import { RedBlackButtonHandler } from './drinks/redBlack/redBlackButtonHandler'
import { gtButtonRow } from './drinks/redBlack/redBlackButtonRows'

const defaultButtonRow = new ActionRowBuilder<ButtonBuilder>()
defaultButtonRow.addComponents(
    new ButtonBuilder({
        custom_id: `${ButtonHandler.TEST}`,
        style: ButtonStyle.Primary,
        label: `Test`,
        disabled: false,
        type: 2,
    })
)

//NB: IKKE PUSH ENDRINGER I DENNE KLASSEN MED MINDRE DET ER GENERISKE HJELPEMETODER

//Skall-klasse for testing av alt mulig random shit.
export class TestCommands extends AbstractCommands {
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = defaultButtonRow
    }

    public async test(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        let msg = new EmbedBuilder().setTitle('Test').setThumbnail('https://cdn.discordapp.com/emojis/1106129265919021066.webp?size=96&quality=lossless')
        let diamonds = await EmojiHelper.getEmoji('diamonds_suit', interaction)        
        let hearts = await EmojiHelper.getEmoji('hearts_suit', interaction)
        let spades = await EmojiHelper.getEmoji('spades_suit', interaction)
        let clubs = await EmojiHelper.getEmoji('clubs_suit', interaction)        
        let buttons = new ActionRowBuilder<ButtonBuilder>()
        
        buttons.addComponents(
            new ButtonBuilder({
                custom_id: `${RedBlackButtonHandler.PLACE}`,
                style: ButtonStyle.Primary,
                label: `Legg kort`,
                disabled: false,
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: `${RedBlackButtonHandler.NEXT_CARD}`,
                style: ButtonStyle.Success,
                label: `Snu neste`,
                disabled: false,
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: `${RedBlackButtonHandler.TEST}`,
                style: ButtonStyle.Secondary,
                label: `Test`,
                disabled: false,
                type: 2,
            })
            // new ButtonBuilder({
            //     custom_id: `${RedBlackButtonHandler.NEXT_CARD}3`,
            //     style: ButtonStyle.Success,
            //     label: '',
            //     emoji: {id: '1107629199935672370'},//diamonds
            //     disabled: false,
            //     type: 2,
            // }),
            // new ButtonBuilder({
            //     custom_id: `${RedBlackButtonHandler.NEXT_CARD}4`,
            //     style: ButtonStyle.Success,
            //     label: '',
            //     emoji: {id: '1107629197037412414'},//clubs
            //     disabled: false,
            //     type: 2,
            // }),
            // new ButtonBuilder({
            //     custom_id: `${RedBlackButtonHandler.NEXT_CARD}`,
            //     style: ButtonStyle.Primary,
            //     label: `Neste kort`,
            //     disabled: false,
            //     type: 2,
            // })
        )
        this.messageHelper.replyToInteraction(interaction, msg, false, false, buttons)
        // msg.setTitle('Test WHAM!')
        // buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        //     new ButtonBuilder({
        //         custom_id: `${ButtonHandler.ELECTRICITY_RESET}`,
        //         style: ButtonStyle.Primary,
        //         label: `Resett kortstokk`,
        //         disabled: false,
        //         type: 2,
        //     })
        // )
        // const allUserTabs = DatabaseHelper.getUser(interaction.user.id)

        // const options: SelectMenuComponentOptionData[] = Object.keys(allUserTabs).map((key) => ({
        //     label: key,
        //     value: key,
        //     description: `${typeof allUserTabs[key]}`,
        // }))

        // const menu = ActionMenuHelper.creatSelectMenu(SelectMenuHandler.userInfoId, 'Test', options)
        // await new Promise(f => setTimeout(f, 3000));
		// await interaction.editReply({ embeds: [msg], components: [buttons, menu] }).catch((e) => console.log(e));
    }

    public async test2(interaction: ChatInputCommandInteraction<CacheType>) {
        const emoji = await EmojiHelper.getEmoji('2C', interaction)
        this.messageHelper.replyToInteraction(interaction, emoji.id + ' ' + emoji.id + ' ' + emoji.id + '\n\n' + emoji.id)
    }

    public async test3(interaction) {

    }

    //Redigerer eksisterende embed hvis det er en knapp interaction, sender ny embed hvis ikke
    private async replyToInteraction(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) {
            this.embedMessage.edit({ embeds: [this.embed] })
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Test')
            this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
            this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
        }
    }

    //Flytt embed ned til bunnen
    private async resendMessages(interaction: ButtonInteraction<CacheType>) {
        this.deleteMessages()
        this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
        this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
    }

    //Slett meldingene
    private deleteMessages() {
        this.embedMessage.delete()
        this.buttonsMessage.delete()
        this.embedMessage = undefined
        this.buttonsMessage = undefined
    }

    private testSwitch(interaction: ChatInputCommandInteraction<CacheType>) {
        const action = interaction.options.getSubcommand()
        if (action) {
            switch (action.toLowerCase()) {
                case '-1-': {
                    this.test(interaction)
                    break
                }
                case '-2-': {
                    this.test2(interaction)
                    break
                }
                case '-3-': {
                    this.test(interaction)
                    break
                }
                case '-4-': {
                    this.test(interaction)
                    break
                }
                default: {
                    this.messageHelper.replyToInteraction(interaction, 'Default test sub-command')
                }
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Ingen test sub-command angitt')
        }
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'test',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.testSwitch(rawInteraction)
                },
            },
        ]
    }
}
