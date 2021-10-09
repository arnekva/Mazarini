import { Message } from 'discord.js'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { countdownTime, dateRegex, DateUtils } from '../utils/dateUtils'
import { ICommandElement } from './commands'

export interface dateValPair {
    print: string
    date: string
}
export class DateCommands {
    static setReminder(message: Message, content: string, args: string[]) {
        // const timeStamp =
        const time = args[0].split('d')
        //Timer

        const minutt = args[0].split('m', 1)
        const sekund = args[0].split('s', 1)
    }
    /**
     *
     * @param dateObj Date object
     * @param textEnding Det som skal stå etter tiden (eks 1 dag 1 time <text ending> - 1 dag og 1 time 'igjen til ferie')
     * @param finishedText Det som printes hvis datoen/tiden har passert
     */
    static formatCountdownText(dateObj: countdownTime | undefined, textEnding: string, finishedText?: string) {
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
    static async countdownToDate(message: Message, messageContent: string, args: string[]) {
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
            const text = DateCommands.formatCountdownText(daysUntil, 'te ' + countdownElement.desc)
            printValues.push({
                print: `${!!text ? '\n' : ''}` + `${DateCommands.formatCountdownText(daysUntil, 'te ' + countdownElement.desc)}`,
                date: countdownElement.date,
            })
        })

        ArrayUtils.sortDateStringArray(printValues)
        printValues.forEach((el) => {
            sendThisText += el.print
        })
        if (!sendThisText) sendThisText = 'Det er ingen aktive countdowner'
        MessageHelper.sendMessage(message, sendThisText)
    }

    static checkForHelg(message: Message, messageContent: string, args: string[]) {
        const isHelg = this.isItHelg()
        let timeUntil
        if (!isHelg) {
            const date = new Date()
            date.setHours(16, 0, 0, 0)
            if (date.getDay() === 5) {
                timeUntil = DateCommands.formatCountdownText(DateUtils.getTimeTo(date), 'til helg')
            } else {
                timeUntil = DateCommands.formatCountdownText(DateUtils.getTimeTo(new Date(DateUtils.nextWeekdayDate(date, 5))), 'til helg')
            }
        }
        MessageHelper.sendMessage(message, isHelg ? `Det e helg!` : `${timeUntil}`)
    }

    static isItHelg() {
        const today = new Date()
        if (today.getDay() == 6 || today.getDay() == 0) return true
        else if (today.getDay() == 5 && today.getHours() > 16) return true
        return false
    }

    static readonly remindMeCommand: ICommandElement = {
        commandName: 'remind',
        description: "Sett en varsling. '1d2t3m4s' for varsling om 1 dag, 2 timer, 3 minutt og 4s. Alle delene er valgfrie (Ikke implementert)",
        hideFromListing: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            DateCommands.setReminder(rawMessage, messageContent, args)
        },

        category: 'annet',
    }
    static readonly helgCommand: ICommandElement = {
        commandName: 'helg',
        description: 'Sjekk hvor lenge det er til helg',
        hideFromListing: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            DateCommands.checkForHelg(rawMessage, messageContent, args)
        },

        category: 'annet',
    }

    static readonly countdownCommand: ICommandElement = {
        commandName: 'countdown',
        description:
            "Se hvor lenge det er igjen til events (Legg til ny med '!mz countdown <dd-mm-yyyy> <hh> <beskrivelse> (klokke kan spesifiserert slik: <hh:mm:ss:SSS>. Kun time er nødvendig)",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            DateCommands.countdownToDate(rawMessage, messageContent, args)
        },
        category: 'annet',
    }
}
