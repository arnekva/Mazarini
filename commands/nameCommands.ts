import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { SlashCommandHelper } from '../helpers/slashCommandHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { RandomUtils } from '../utils/randomUtils'

export class NameCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private handleNameCommands(interaction: ChatInputCommandInteraction<CacheType>) {
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
                const texts = this.listTexts(textToDeleteUser)
                if (texts) {
                    let text = ''
                    texts.forEach((t, i) => (text += `\n${i}: ${t}`))
                    this.messageHelper.replyToInteraction(interaction, text)
                } else {
                    this.messageHelper.replyToInteraction(interaction, 'Du skrev ikke inn et gyldig navn', { ephemeral: true })
                }
            } else {
                const deleted = this.removeTextValueFromInteraction(textToDelete, textToDeleteUser)
                if (deleted) this.messageHelper.replyToInteraction(interaction, `Slettet indeks *${textToDelete}* for *${textToDeleteUser}*`)
                else
                    this.messageHelper.replyToInteraction(
                        interaction,
                        `Klarte ikke slette tekst. Enten manglet indeks (${textToDelete}) eller brukernavn (${textToDeleteUser})`
                    )
            }
        } else if (personToLookUp) {
            if (personToLookUp === 'joiij') {
                this.messageHelper.replyToInteraction(interaction, this.joiijText())
            } else {
                this.messageHelper.replyToInteraction(interaction, this.getTextFromCommand(personToLookUp))
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

    private getTextFromCommand(username: string) {
        const text: string = ArrayUtils.randomChoiceFromArray(DatabaseHelper.getTextCommandValueArray(username.toLowerCase()) ?? []) || 'Ingen tekst lagt til'
        return `${text.startsWith('<:') ? '' : username} ${
            ArrayUtils.randomChoiceFromArray(DatabaseHelper.getTextCommandValueArray(username.toLowerCase()) ?? []) || 'Ingen tekst lagt til'
        }`
    }

    private addTextValueFromInteraction(text: string, username: string): boolean {
        if (this.getLegalTextCommandNames().includes(username) && text.length > 1) {
            DatabaseHelper.setTextCommandValue(username, text)
            return true
        }
        return false
    }

    private listTexts(username: string): string[] {
        return DatabaseHelper.getTextCommandValueArray(username) as string[]
    }

    private removeTextValueFromInteraction(index: number, username: string): boolean {
        const texts = DatabaseHelper.getTextCommandValueArray(username) as string[]
        if (texts) {
            texts.splice(index, 1)
            DatabaseHelper.nukeTextCommand(username, texts)
            texts.forEach((t) => DatabaseHelper.setTextCommandValue(username, t))
            return true
        } else {
            return false
        }
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
