import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper, ferieItem } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { countdownTime, dateRegex, DateUtils } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'

const holidays = require('holidays-norway').default

export interface dateValPair {
    print: string
    date: string
}

export class DateCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    private setReminder(interaction: ChatInputCommandInteraction<CacheType>) {
        const timeArray = (interaction.options.get('tid')?.value as string).split(':')
        const event = interaction.options.get('tekst')?.value as string

        const hoursInMilli = Number(timeArray[0]) * 3600 * 1000
        const minInMilli = Number(timeArray[1]) * 60000
        const secInMilli = Number(timeArray[2]) * 1000
        const timeout = hoursInMilli + minInMilli + secInMilli
        if (timeArray.length < 3) {
            this.messageHelper.replyToInteraction(interaction, 'Formattering på tid må være HH:MM:SS', true)
        } else if (event.length < 1) {
            this.messageHelper.replyToInteraction(interaction, 'Du må spesifisere hva påminnelsen gjelder', true)
        } else {
            this.messageHelper.replyToInteraction(
                interaction,
                `Påminnelsen din er satt for *${event}* om *${timeArray[0] ? timeArray[0] + ' timer, ' : ''} ${timeArray[1]} minutter og ${
                    timeArray[2]
                } sekunder*`
            )
            setTimeout(() => {
                this.messageHelper.sendMessage(interaction?.channelId, `***Påminnelse for ${MentionUtils.mentionUser(interaction.user.id)}***\n*${event}*`)
            }, timeout)
        }
    }

    private formatCountdownText(dateObj: countdownTime | undefined, textEnding: string, finishedText?: string, noTextEnding?: boolean) {
        if (!dateObj) return finishedText ?? ''
        const timeTab: string[] = []
        let timeString = 'Det er'

        if (dateObj.days > 0) timeTab.push(' ' + dateObj.days + ` ${dateObj.days == 1 ? 'dag' : 'dager'}`)
        if (dateObj.hours > 0) timeTab.push(' ' + dateObj.hours + ` ${dateObj.hours == 1 ? 'time' : 'timer'}`)
        if (dateObj.minutes > 0) timeTab.push(' ' + dateObj.minutes + ` ${dateObj.minutes == 1 ? 'minutt' : 'minutter'}`)
        if (dateObj.seconds > 0) timeTab.push(' ' + dateObj.seconds + ` ${dateObj.seconds == 1 ? 'sekund' : 'sekunder'}`)
        if (timeTab.length < 1) return noTextEnding ? '' : textEnding + ' er ferdig!'
        timeTab.forEach((text, index) => {
            timeString += text
            if (index <= timeTab.length - 2 && timeTab.length > 1) timeString += index == timeTab.length - 2 ? ' og' : ','
        })
        timeString += ' ' + textEnding
        return timeString
    }

    //TODO: Fix this one
    private registerFerie(interaction: ChatInputCommandInteraction<CacheType>) {
        const isSet = interaction.options.getSubcommand() === 'sett'
        const isVis = interaction.options.getSubcommand() === 'vis'
        const fromDate = interaction.options.get('fra-dato')?.value as string
        const toDate = interaction.options.get('til-dato')?.value as string
        if (fromDate === 'fjern' || toDate === 'fjern') {
            return DatabaseHelper.deleteFerieValue(interaction.user.id)
        }

        /** Registrer ferier */

        //dd-mm-yyyy
        if (isSet) {
            const isLegal = dateRegex.test(fromDate) && dateRegex.test(toDate)
            if (!isLegal) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    `En av datoene er ikke formattert riktig. Husk at det må være dd-mm-yyyy. Eksempelvis 24-07-2022`,
                    true
                )
            }
            moment.locale('nb')
            const date1 = moment(fromDate, 'DD-MM-YYYY').toDate() // new Date(args[0])
            const date2 = moment(toDate, 'DD-MM-YYYY').toDate()
            const feireObj: ferieItem = {
                fromDate: date1,
                toDate: date2,
            }
            const maxNumDays = 200
            if (DateUtils.isDateBefore(date1, date2) && DateUtils.dateIsMaxXDaysInFuture(date2, maxNumDays)) {
                DatabaseHelper.setFerieValue(interaction.user.id, 'date', JSON.stringify(feireObj))
                this.messageHelper.replyToInteraction(interaction, `Ferien din e satt`, true)
            } else {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Dato 1 må være før dato 2, og ferie kan maks settes til ${maxNumDays} dager frem i tid fra nåværende dato`
                )
            }
        } else {
            if (Object.keys(DatabaseHelper.getAllFerieValues()).length < 1) {
                return this.messageHelper.replyToInteraction(interaction, `Ingen har ferie i nærmeste fremtid`)
            }
            let sendThisText = ''
            const ferieDates = DatabaseHelper.getAllFerieValues()
            /** Finn alle ferier og print dem hvis de er gyldige */
            Object.keys(ferieDates).forEach((username) => {
                if (DatabaseHelper.getNonUserValue('ferie', username)?.date) {
                    const ferieEle = JSON.parse(DatabaseHelper.getNonUserValue('ferie', username).date) as ferieItem
                    const date1 = moment(new Date(ferieEle.fromDate), 'DD-MM-YYYY').toDate()
                    const date2 = moment(new Date(ferieEle.toDate), 'DD-MM-YYYY').toDate()
                    if (!DateUtils.dateHasPassed(date2)) {
                        const timeRemaining = DateUtils.dateHasPassed(date1)
                            ? `(${DateUtils.getTimeTo(date2)?.days} dager igjen av ferien)`
                            : `(${DateUtils.getTimeTo(date1)?.days} dager igjen til ferien starter)`
                        sendThisText += `\n${UserUtils.findUserById(username, interaction).username} har ferie mellom ${moment(date1).format('ll')} og ${moment(
                            date2
                        ).format('ll')} ${timeRemaining}`
                    }
                }
            })

            if (!sendThisText) sendThisText = 'Ingen har ferie lenger :('
            this.messageHelper.replyToInteraction(interaction, sendThisText)
        }
    }
    private async countdownToDate(interaction: ChatInputCommandInteraction<CacheType>) {
        const isNewCountdown = interaction.options.getSubcommand() === 'sett'
        const isPrinting = interaction.options.getSubcommand() === 'vis'

        const event = interaction.options.get('hendelse')?.value as string
        const dato = interaction.options.get('dato')?.value as string
        const timestamp = interaction.options.get('klokkeslett')?.value as string

        if (isNewCountdown) {
            if (event == 'fjern') {
                this.messageHelper.replyToInteraction(interaction, `Fjernet countdownen din`, true)
                return DatabaseHelper.deleteCountdownValue(interaction.user.id)
            }

            //dd-mm-yyyy
            const isLegal = dateRegex.test(dato)
            if (!isLegal) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    'du må formattere datoen ordentlig (dd-mm-yyyy). Hvis du bare prøve å se aktive countdowns, bruk /countdown vis',
                    true
                )
            }
            const dateParams = dato.split('-')
            const hrs = timestamp.split(':')

            const cdDate = new Date(
                Number(dateParams[2]),
                Number(dateParams[1]) - 1,
                Number(dateParams[0]),
                Number(hrs[0]),
                Number(hrs[1] ?? 0),
                Number(hrs[2] ?? 0),
                Number(hrs[3] ?? 0)
            )
            if (!DateUtils.isValidDate(cdDate)) {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `  'Du har skrevet inn en ugyldig dato eller klokkeslett. <dd-mm-yyyy> <HH> <beskrivelse>. Husk at time er nødvendig, minutt og sekund frivillig (HH:MM:SS)'`
                )
            }
            DatabaseHelper.setCountdownValue(interaction.user.id, 'date', cdDate.toString())
            DatabaseHelper.setCountdownValue(interaction.user.id, 'desc', event)
            this.messageHelper.replyToInteraction(
                interaction,
                `Din countdown for *${event}* er satt til ${cdDate.toLocaleDateString('nb', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })} ${cdDate.toLocaleTimeString('nb')}`
            )
        } else if (isPrinting) {
            let sendThisText = ''
            if (Object.keys(DatabaseHelper.getAllCountdownValues()).length < 1) {
                return this.messageHelper.replyToInteraction(interaction, `Det er ingen aktive countdowns`)
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
            this.messageHelper.replyToInteraction(interaction, sendThisText)
        }
    }

    private findHolidaysInThisWeek(checkForNextWeeksMonday?: boolean) {
        moment.locale('en')
        const holidaysFromYear = holidays(new Date().getFullYear())

        const holidaysThisWeek: { name: string; date: string }[] = []
        /** FIXME: Sets locale to en to avoid mess with js dates for the time being. Need to add 1 days to start of week since that would be sunday in en locale.
         * When fixed, make sure to remove the add days.
         */
        const startNextWeek = moment().add(1, 'weeks').startOf('week').add(1, 'days')

        holidaysFromYear.forEach((day: { name: string; date: string }) => {
            const date = new Date(day.date)

            /** Override the name the package uses */
            if (day.name.includes('Himmelsprettsdag')) day.name = 'Kristi himmelfartsdag'
            if (checkForNextWeeksMonday) {
                /** If week is same as next week, and it's the same day (monday), we have a langhelg */
                if (moment(date).isSame(startNextWeek, 'week') && moment(date).isSame(startNextWeek, 'day')) {
                    holidaysThisWeek.push(day)
                }
            } else {
                if (moment(date).isSame(new Date(), 'week')) {
                    if (!this.isInWeekend(date)) holidaysThisWeek.push(day)
                }
            }
        })
        /** set locale back to nb */
        moment.locale('nb')
        return holidaysThisWeek
    }

    private isInWeekend(date: Date) {
        const dayOfWeek = date.getDay()
        return dayOfWeek === 6 || dayOfWeek === 0
    }

    private findWeekendStart(): Date | undefined {
        const holidays = this.findHolidaysInThisWeek()
        const allDates: Date[] = []
        holidays.forEach((day) => {
            allDates.push(new Date(day.date))
        })
        const allDays = allDates.map((d) => d.getDay())
        allDays.sort()
        let weekendStart = 6
        for (let i = 5; i > 0; i--) {
            if (!allDays.includes(i)) {
                weekendStart = i + 1
                break
            }
        }
        return allDates.find((d) => d.getDay() === weekendStart)
    }

    private isTodayHoliday() {
        const h = this.findHolidaysInThisWeek()
        return !!h.find((d) => new Date(d.date).getDay() === new Date().getDay())
    }

    private nextWeekHasHolidayOnMonday() {
        const mondayHoliday = this.findHolidaysInThisWeek(true)
        return mondayHoliday
    }

    private async getTimeUntilHelgString() {
        const isHelg = this.isItHelg()
        const holidays = this.findHolidaysInThisWeek()
        let timeUntil = ''
        if (!isHelg) {
            let hasFoundWeekendStart = false
            holidays.forEach((day) => {
                if (!hasFoundWeekendStart) {
                    if (new Date(day.date).getDay() === this.findWeekendStart()?.getDay()) {
                        hasFoundWeekendStart = true
                        timeUntil += `${this.formatCountdownText(DateUtils.getTimeTo(new Date(day.date)), `til langhelgå så starte med ${day.name}`)}\n`
                    } else timeUntil += `${this.formatCountdownText(DateUtils.getTimeTo(new Date(day.date)), `til ${day.name}`)}\n`
                }
            })
            if (!hasFoundWeekendStart) {
                const possibleWeekendStart = this.findWeekendStart()
                if (possibleWeekendStart) {
                    timeUntil += this.formatCountdownText(DateUtils.getTimeTo(possibleWeekendStart), 'til langhelg')
                } else {
                    const doesNextWeekHaveHolidayOnMonday = this.nextWeekHasHolidayOnMonday()[0]
                    const date = new Date()
                    const isFriday = date.getDay() === 5
                    const isAfter16 = date.getHours() >= 16
                    const nextWeekendStart = new Date(DateUtils.nextWeekdayDate(date, 5))
                    nextWeekendStart.setHours(16)
                    const timeTo = DateUtils.getTimeTo(isFriday ? date : nextWeekendStart)
                    const isLessThan4HoursAway = timeTo?.days == 0 && timeTo?.hours < 4
                    const emoji = EmojiHelper.getHelgEmoji(this.client, isLessThan4HoursAway)

                    if (isFriday && isAfter16) return 'Det e helg!'

                    const textToPrint = `til ${doesNextWeekHaveHolidayOnMonday ? `langhelg! (${doesNextWeekHaveHolidayOnMonday.name})` : 'helg'} ${emoji}`

                    const timeToPrint = this.formatCountdownText(timeTo, textToPrint) || 'Eg vett ikkje korti det e helg atm, Arne har visst fucka koden min'

                    if (this.isTodayHoliday()) {
                        return 'Det e fridag!'
                    }
                    return timeToPrint
                }
            }
        }
        return timeUntil
    }

    public async checkForHelg(interaction?: ChatInputCommandInteraction<CacheType>) {
        const isHelg = this.isItHelg()
        const val = (await isHelg) ? `Det e helg!` : `${await this.getTimeUntilHelgString()}`
        if (interaction) this.messageHelper.replyToInteraction(interaction, val)
        return val
    }

    private addUserBirthday(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        const birthDayFromArg = interaction.options.get('dato')?.value as string
        const birthday = user.birthday
        if (birthday && !birthDayFromArg) {
            const bdTab = birthday.split('-').map((d: any) => Number(d))
            const today = new Date()
            let date = new Date(new Date().getFullYear(), bdTab[1] - 1, bdTab[0])

            if (bdTab[1] < today.getMonth() + 1) {
                date = new Date(new Date().getFullYear() + 1, bdTab[1] - 1, bdTab[0])
            }
            if (bdTab[1] == today.getMonth() + 1 && today.getDate() > bdTab[0]) {
                date = new Date(new Date().getFullYear() + 1, bdTab[1] - 1, bdTab[0])
            }

            if (DateUtils.isToday(date)) {
                this.messageHelper.replyToInteraction(interaction, 'Du har bursdag i dag! gz')
            } else {
                const timeUntilBirthday = this.formatCountdownText(DateUtils.getTimeTo(date), `til ${interaction.user.username} sin bursdag.`, undefined, true)
                this.messageHelper.replyToInteraction(interaction, timeUntilBirthday ?? 'Klarte ikke regne ut')
            }
        } else if (birthDayFromArg) {
            const dateString = birthDayFromArg
            if (dateString.split('-').length < 2 || (!(new Date(dateString) instanceof Date) && !isNaN(new Date(dateString).getTime()))) {
                this.messageHelper.replyToInteraction(interaction, `Formatteringen din er feil (${dateString}). Det må formatteres dd-mm-yyyy`, true)
            } else {
                user.birthday = dateString
                DatabaseHelper.updateUser(user)
                this.messageHelper.replyToInteraction(interaction, `Satte bursdagen din til ${dateString}`)
            }
        } else {
            this.messageHelper.replyToInteraction(
                interaction,
                `Du har ikke satt bursdagen din. Legg ved datoen formattert dd-mm-yyyy som argument når du kaller /bursdag neste gang`,
                true
            )
        }
    }

    public isItHelg() {
        const today = new Date()
        if (today.getDay() == 6 || today.getDay() == 0) return true
        else if (today.getDay() == 5 && today.getHours() > 16) return true
        return false
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'helg',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.checkForHelg(rawInteraction)
                },
            },
            {
                commandName: 'ferie',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.registerFerie(rawInteraction)
                },
            },
            {
                commandName: 'reminder',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.setReminder(rawInteraction)
                },
            },
            {
                commandName: 'bursdag',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.addUserBirthday(rawInteraction)
                },
            },
            {
                commandName: 'countdown',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.countdownToDate(rawInteraction)
                },
            },
        ]
    }
}
