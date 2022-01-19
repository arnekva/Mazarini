import { time } from 'console'
import { Client, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { globalArrays } from '../globals'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { countdownTime, dateRegex, DateUtils } from '../utils/dateUtils'
import { ICommandElement } from '../General/commands'
export interface dateValPair {
    print: string
    date: string
}

export class DateCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    private setReminder(message: Message, content: string, args: string[]) {
        const timeArray = args[0].split(':')
        const event = args.slice(1).join(' ')

        const hoursInMilli = Number(timeArray[0]) * 3600 * 1000
        const minInMilli = Number(timeArray[1]) * 60000
        const secInMilli = Number(timeArray[2]) * 1000
        const timeout = hoursInMilli + minInMilli + secInMilli
        if (timeArray.length < 3) {
            message.reply('Formattering på tid må være HH:MM:SS')
            return
        }
        if (event.length < 1) {
            message.reply('Du må spesifisere hva påminnelsen gjelder')
            return
        }
        this.messageHelper.reactWithRandomEmoji(message)
        setTimeout(() => {
            message.reply(`Her e din påminnelse om *${event}*`)
        }, timeout)
    }

    private formatCountdownText(dateObj: countdownTime | undefined, textEnding: string, finishedText?: string) {
        if (!dateObj) return finishedText ?? ''
        const timeTab: string[] = []
        let timeString = 'Det er'

        if (dateObj.days > 0) timeTab.push(' ' + dateObj.days + ` ${dateObj.days == 1 ? 'dag' : 'dager'}`)
        if (dateObj.hours > 0) timeTab.push(' ' + dateObj.hours + ` ${dateObj.hours == 1 ? 'time' : 'timer'}`)
        if (dateObj.minutes > 0) timeTab.push(' ' + dateObj.minutes + ` ${dateObj.minutes == 1 ? 'minutt' : 'minutter'}`)
        if (dateObj.seconds > 0) timeTab.push(' ' + dateObj.seconds + ` ${dateObj.seconds == 1 ? 'sekund' : 'sekunder'}`)
        if (timeTab.length < 1) return textEnding + ' er ferdig!'
        timeTab.forEach((text, index) => {
            timeString += text
            if (index <= timeTab.length - 2 && timeTab.length > 1) timeString += index == timeTab.length - 2 ? ' og' : ','
        })
        timeString += ' ' + textEnding
        return timeString
    }
    private async countdownToDate(message: Message, messageContent: string, args: string[]) {
        if (args[0] == 'fjern') {
            DatabaseHelper.deleteCountdownValue(message.author.username)
            return
        }
        if (args[0] && (!args[1] || !args[2])) {
            message.reply('du mangler beskrivelse eller time (!mz countdown <dd-mm-yyyy> <HH> <beskrivelse>')
            return
        }

        if (args.length >= 2) {
            //dd-mm-yyyy
            const isLegal = dateRegex.test(args[0])
            if (!isLegal) {
                message.reply('du må formattere datoen ordentlig (dd-mm-yyyy)')
                return
            }
            const dateParams = args[0].split('-')
            const hrs = args[1].split(':')
            const desc = args.slice(2).join(' ')
            const cdDate = new Date(
                Number(dateParams[2]),
                Number(dateParams[1]) - 1,
                Number(dateParams[0]),
                Number(hrs[0]),
                Number(hrs[1] ?? 0),
                Number(hrs[2] ?? 0),
                Number(hrs[3] ?? 0)
            )
            DatabaseHelper.setCountdownValue(message.author.username, 'date', cdDate.toString())
            DatabaseHelper.setCountdownValue(message.author.username, 'desc', desc)
        }
        let sendThisText = ''
        if (Object.keys(DatabaseHelper.getAllCountdownValues()).length < 1) {
            message.reply('Det er ingen aktive countdowns')
            return
        }
        const countdownDates = DatabaseHelper.getAllCountdownValues()

        const printValues: dateValPair[] = []

        Object.keys(countdownDates).forEach((username) => {
            const countdownElement = DatabaseHelper.getNonUserValue('countdown', username)
            const daysUntil = DateUtils.getTimeTo(new Date(countdownElement.date))
            const text = this.formatCountdownText(daysUntil, 'te ' + countdownElement.desc)
            printValues.push({
                print: `${!!text ? '\n' : ''}` + `${this.formatCountdownText(daysUntil, 'te ' + countdownElement.desc)}`,
                date: countdownElement.date,
            })
        })

        ArrayUtils.sortDateStringArray(printValues)
        printValues.forEach((el) => {
            sendThisText += el.print
        })
        if (!sendThisText) sendThisText = 'Det er ingen aktive countdowner'
        this.messageHelper.sendMessage(message.channelId, sendThisText)
    }

    private async checkForHelg(message: Message, messageContent: string, args: string[]) {
        const isHelg = this.isItHelg()
        const url = 'https://webapi.no/api/v1/holidays/2021'
        let timeUntil
        if (!isHelg) {
            const date = new Date()
            date.setHours(16, 0, 0, 0)
            if (date.getDay() === 5) {
                if (new Date().getHours() < 16) timeUntil = this.formatCountdownText(DateUtils.getTimeTo(date), 'til helg')
                else timeUntil = `Det e helg!`
            } else {
                timeUntil = this.formatCountdownText(DateUtils.getTimeTo(new Date(DateUtils.nextWeekdayDate(date, 5))), 'til helg')
            }
        }
        this.messageHelper.sendMessage(message.channelId, isHelg ? `Det e helg!` : `${timeUntil}`)
    }

    private isItHelg() {
        const today = new Date()
        if (today.getDay() == 6 || today.getDay() == 0) return true
        else if (today.getDay() == 5 && today.getHours() > 16) return true
        return false
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'remind',
                description:
                    "Sett en varsling. Formattering: '!mz remind HH:MM:SS tekst her'. Denne er ikke lagret vedvarende, så den forsvinner hvis botten restarter.",
                hideFromListing: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.setReminder(rawMessage, messageContent, args)
                },

                category: 'annet',
            },
            {
                commandName: 'helg',
                description: 'Sjekk hvor lenge det er til helg',
                hideFromListing: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.checkForHelg(rawMessage, messageContent, args)
                },

                category: 'annet',
            },
            {
                commandName: 'countdown',
                description:
                    "Se hvor lenge det er igjen til events (Legg til ny med '!mz countdown <dd-mm-yyyy> <hh> <beskrivelse> (klokke kan spesifiserert slik: <hh:mm:ss:SSS>. Kun time er nødvendig)",
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.countdownToDate(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
        ]
    }
}
