import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'
import { SlashCommandHelper } from '../helpers/slashCommandHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { RandomUtils } from '../utils/randomUtils'

export class NameCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async handleNameCommands(interaction: ChatInputCommandInteraction<CacheType>) {
        const textToAdd = interaction.options.get('tekst')?.value as string
        const userTextIsAddedTo = interaction.options.get('bruker')?.value as string
        const textToDelete = SlashCommandHelper.getCleanNumberValue(interaction.options.get('indeks')?.value)
        const textToDeleteUser = interaction.options.get('brukeren')?.value as string
        const personToLookUp = interaction.options.get('navn')?.value as string

        if (textToAdd && userTextIsAddedTo) {
            const added = this.addTextValueFromInteraction(textToAdd, userTextIsAddedTo)
            if (added) this.messageHelper.replyToInteraction(interaction, `La til *${textToAdd}* for *${userTextIsAddedTo}*`)
            else
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Klarte ikke legge til tekst. Enten manglet tekst (${textToAdd}) eller brukernavn (${userTextIsAddedTo})`
                )
        } else if (textToDeleteUser) {
            if (!textToDelete) {
                const texts = await this.listTexts(textToDeleteUser)
                if (texts) {
                    let text = ''
                    texts.forEach((t, i) => (text += `\n${i}: ${t}`))
                    this.messageHelper.replyToInteraction(interaction, text)
                } else {
                    this.messageHelper.replyToInteraction(interaction, 'Du skrev ikke inn et gyldig navn', { ephemeral: true })
                }
            } else {
                this.removeTextValueFromInteraction(textToDelete, textToDeleteUser)
                this.messageHelper.replyToInteraction(interaction, `Slettet indeks *${textToDelete}* for *${textToDeleteUser}*`)

            }
        } else if (personToLookUp) {
            if (personToLookUp === 'joiij') {
                this.messageHelper.replyToInteraction(interaction, this.joiijText())
            } else {
                this.messageHelper.replyToInteraction(interaction, await this.getTextFromCommand(personToLookUp))
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, 'En feil har skjedd')
        }
    }

    private joiijText() {
        const hr = RandomUtils.getRandomInteger(0, 3)
        const min = RandomUtils.getRandomInteger(1, 59)
        const getHrLine = (h: number) => {
            return h === 1 ? 'time' : 'timer'
        }
        return `Joiij e der om ${hr === 0 ? '' : hr + ' ' + getHrLine(hr) + ' og '}${min} minutt!`
    }

    private async getTextFromCommand(username: string) {
        const text: string = ArrayUtils.randomChoiceFromArray(await this.client.db.getTextCommandValueArray(username.toLowerCase()) ?? []) || 'Ingen tekst lagt til'
        return `${text.startsWith('<:') ? '' : username} ${text || 'Ingen tekst lagt til'}`
    }

    private addTextValueFromInteraction(text: string, username: string): boolean {
        if (this.getLegalTextCommandNames().includes(username) && text.length > 1) {
            this.client.db.setTextCommandValue(username, text)
            return true
        }
        return false
    }

    private async listTexts(username: string): Promise<string[]> {
        return await this.client.db.getTextCommandValueArray(username) as string[]
    }

    private async removeTextValueFromInteraction(index: number, username: string) {
        this.client.db.nukeTextCommand(username, index) 
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'navn',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleNameCommands(rawInteraction)
                        },
                    },
                ],
            },
        }
    }

    getLegalTextCommandNames(): string[] {
        return ['thomas', 'arne', 'maggi', 'eivind', 'sivert', 'joiij', 'darri', 'david', 'rogga']
    }
}
