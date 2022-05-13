import { Client, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { RandomUtils } from '../utils/randomUtils'

export class NameCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async oyvindText(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }
    private async maggiText(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }

    private async davidText(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }

    private async thomasText(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }

    private async darriText(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }

    private async arneText(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }

    private async steveText(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }
    private async joiijText(message: Message) {
        const hr = RandomUtils.getRndInteger(0, 3)
        const min = RandomUtils.getRndInteger(1, 59)
        const getHrLine = (h: number) => {
            return h === 1 ? 'time' : 'timer'
        }
        const joiij = await this.messageHelper.sendMessage(message.channelId, `Joiij e der om ${hr === 0 ? '' : hr + ' timer og '}${min} minutt!`)
    }

    private findCommandName(message: Message, needsIndex?: number) {
        return message.content.split(' ')[needsIndex ? needsIndex : 1]
    }

    private async eivind(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, this.getTextFromCommand(message))
    }

    //TODO / FIXME: Refactor å finne første command name hvis array til en egen funksjon. BLir brukt 2 steder atm
    private getTextFromCommand(message: Message) {
        let commandName = this.findCommandName(message)
        const cmdName = this.getAllCommands().find((c) =>
            Array.isArray(c.commandName) ? c.commandName.includes(commandName.toLowerCase()) : c.commandName.toLowerCase() == commandName.toLowerCase()
        )?.commandName

        commandName = Array.isArray(cmdName) ? cmdName[0] : commandName
        return ArrayUtils.randomChoiceFromArray(DatabaseHelper.getTextCommandValueArray(commandName.toLowerCase()) ?? []) || 'Ingen tekst lagt til'
    }

    private async addTextValue(message: Message, messageContent: string, args: string[]) {
        let commandName = args[0].toLowerCase()
        const textToAdd = args.slice(1).join(' ')
        if (!textToAdd.trim()) {
            return message.reply('Du kan ikke legge til tom tekst')
        }
        if (this.getAllCommands().find((c) => (Array.isArray(c.commandName) ? c.commandName.includes(commandName) : c.commandName == commandName))) {
            const cmdName = this.getAllCommands().find((c) =>
                Array.isArray(c.commandName) ? c.commandName.includes(commandName) : c.commandName == commandName
            )?.commandName

            commandName = Array.isArray(cmdName) ? cmdName[0] : commandName
            DatabaseHelper.setTextCommandValue(commandName, textToAdd)
            message.reply(`La til teksten ***${textToAdd}*** for kommandoen **${commandName}**`)
        } else {
            message.reply(`Fant ikke kommandoen ved navn ${commandName}. Du kan kun knytte tekster til kommandoer i NameCommands`)
        }
    }
    private async removeTextValue(message: Message, messageContent: string, args: string[]) {
        const commandName = this.findCommandName(message, 2)
        const textToDelete = Number(args[1])
        const texts = DatabaseHelper.getTextCommandValueArray(commandName) as string[]
        if (texts) {
            if (isNaN(textToDelete) || textToDelete < 0 || textToDelete >= texts.length) {
                return message.reply('Du må spesifisere indeksen til teksten du vil slette. Velg en av disse:\n' + texts.map((t, i) => `${i}: ${t}`).join('\n'))
            }
            const index = texts.indexOf(texts[textToDelete])
            message.reply(`Sletter ${texts[textToDelete]} fra tekstlisten`)
            texts.splice(index, 1)
            DatabaseHelper.nukeTextCommand(commandName, texts)
            //FIXME: Hvorfor må det settes individuelt?
            texts.forEach((t) => DatabaseHelper.setTextCommandValue(commandName, t))
        } else {
            message.reply('Det er ingen tekster lagt til her enda')
        }
    }

    getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'add',
                description: 'Legg til tekst til en tekstkommando',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.addTextValue(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'remove',
                description: 'Legg til tekst til en tekstkommando',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.removeTextValue(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: ['oyvind', 'røgga', 'øyvind'],
                description: 'Vask huset maen. Og husk å vask den fine klokkå',
                command: (rawMessage: Message, messageContent: string) => {
                    this.oyvindText(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'maggi',
                description: 'E han ude å fyre?',
                command: (rawMessage: Message, messageContent: string) => {
                    this.oyvindText(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'eivind',
                description: 'Eivind sin feil',
                command: (rawMessage: Message, messageContent: string) => {
                    this.eivind(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: ['sivert', 'geggien', 'trackpad', 'steve'],
                description: 'Geggien e på an igjen',
                command: (rawMessage: Message, messageContent: string) => {
                    this.steveText(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'thomas',
                description: 'Thomas svarer alltid ja',
                command: (rawMessage: Message, messageContent: string) => {
                    this.thomasText(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'darri',
                description: 'Hæ, darri?',
                command: (rawMessage: Message, messageContent: string) => {
                    this.darriText(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'david',
                description: 'nå klikke det snart',
                command: (rawMessage: Message, messageContent: string) => {
                    this.davidText(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'arne',
                description: 'Bare Arne being Arne',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.arneText(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'joiij',
                description: 'Kor lenge e det te Joiij e der?',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.joiijText(rawMessage)
                },
                category: 'annet',
            },
        ]
    }
}
