import { CacheType, Client, Interaction, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { SlashCommandHelper } from '../helpers/slashCommandHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { RandomUtils } from '../utils/randomUtils'

export class NameCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async joiijText(message: Message) {
        const hr = RandomUtils.getRndInteger(0, 3)
        const min = RandomUtils.getRndInteger(1, 59)
        const getHrLine = (h: number) => {
            return h === 1 ? 'time' : 'timer'
        }
        await this.messageHelper.sendMessage(message.channelId, `Joiij e der om ${hr === 0 ? '' : hr + ' timer og '}${min} minutt!`)
    }

    private findCommandName(message: Message, needsIndex?: number) {
        return message.content.split(' ')[needsIndex ? needsIndex : 1]
    }

    private handleNameCommands(rawInteraction: Interaction<CacheType>) {
        const interaction = SlashCommandHelper.getTypedInteraction(rawInteraction)
        if (interaction) {
            const textToAdd = interaction.options.get('tekst')?.value as string
            const userTextIsAddedTo = interaction.options.get('bruker')?.value as string
            const textToDelete = interaction.options.get('indeks')?.value as number
            const textToDeleteUser = interaction.options.get('brukeren')?.value as string
            const personToLookUp = interaction.options.get('navn')?.value as string

            if (textToAdd && userTextIsAddedTo) {
                const added = this.addTextValueFromInteraction(textToAdd, userTextIsAddedTo)
                if (added) interaction.reply(`La til *${textToAdd}* for *${userTextIsAddedTo}*`)
                else interaction.reply(`Klarte ikke legge til tekst. Enten manglet tekst (${textToAdd}) eller brukernavn (${userTextIsAddedTo})`)
            } else if (textToDeleteUser) {
                if (!textToDelete) {
                    const texts = this.listTexts(textToDeleteUser)
                    if (texts) {
                        let text = ''
                        texts.forEach((t, i) => (text += `\n${i}: ${t}`))
                        interaction.reply(text)
                    } else {
                        interaction.reply({ content: 'Du skrev ikke inn et gyldig navn', ephemeral: true })
                    }
                } else {
                    const deleted = this.removeTextValueFromInteraction(textToDelete, textToDeleteUser)
                    if (deleted) interaction.reply(`Slettet indeks *${textToDelete}* for *${textToDeleteUser}*`)
                    else interaction.reply(`Klarte ikke slette tekst. Enten manglet indeks (${textToDelete}) eller brukernavn (${textToDeleteUser})`)
                }
            } else if (personToLookUp) {
                interaction.reply(this.getTextFromCommand(personToLookUp))
            } else {
            }
        } else {
            interaction.reply('Kunne ikke finne data på valgte modus')
        }
    }

    private getTextFromCommand(username: string) {
        return ArrayUtils.randomChoiceFromArray(DatabaseHelper.getTextCommandValueArray(username.toLowerCase()) ?? []) || 'Ingen tekst lagt til'
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

    getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'add',
                description: 'Legg til tekst til en tekstkommando',
                isReplacedWithSlashCommand: 'navn add',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {},
                category: 'annet',
            },
            {
                commandName: 'remove',
                description: 'Legg til tekst til en tekstkommando',
                isReplacedWithSlashCommand: 'navn delete',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {},
                category: 'annet',
            },
            {
                commandName: ['arne', 'david', 'thomas', 'darri', 'sivert', 'geggien', 'eivind', 'maggi', 'øyvind', 'joiij'],
                description: 'Hent tekst om et navn',
                isReplacedWithSlashCommand: 'navn',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {},
                category: 'annet',
            },
        ]
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'navn',
                command: (rawInteraction: Interaction<CacheType>) => {
                    this.handleNameCommands(rawInteraction)
                },
                category: 'gaming',
            },
        ]
    }

    getLegalTextCommandNames(): string[] {
        return ['thomas', 'arne', 'maggi', 'eivind', 'sivert', 'joiij', 'darri', 'david', 'rogga']
    }
}
