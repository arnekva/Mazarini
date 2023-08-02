import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ferieItem, ICountdownItem } from '../interfaces/database/databaseInterface'
import { ArrayUtils } from '../utils/arrayUtils'
import { dateRegex, DateUtils, timeRegex } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'

const holidays = require('holidays-norway').default

export interface dateValPair {
    print: string
    date: string | Date
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

    //TODO: Fix this one
    private registerFerie(interaction: ChatInputCommandInteraction<CacheType>) {
        const isSet = interaction.options.getSubcommand() === 'sett'
        const isVis = interaction.options.getSubcommand() === 'vis'
        const fromDate = interaction.options.get('fra-dato')?.value as string
        const toDate = interaction.options.get('til-dato')?.value as string
        const fromHours = interaction.options.get('fra-klokkeslett')?.value as string
        if (fromDate === 'fjern' || toDate === 'fjern') {
            return DatabaseHelper.deleteFerieValue(interaction.user.id)
        }

        /** Registrer ferier */

        //dd-mm-yyyy
        if (isSet) {
            const isLegal = dateRegex.test(fromDate) && dateRegex.test(toDate)
            const isLegalTime = timeRegex.test(fromHours)
            if (!isLegal) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    `En av datoene er ikke formattert riktig. Husk at det må være dd-mm-yyyy. Eksempelvis 24-07-2022`,
                    true
                )
            }
            if (!isLegalTime) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    `Klokkeslettet ditt er ikke formattert riktig. Det må være i formatet HH:MM (eksempelvis 17:30)`,
                    true
                )
            }
            moment.locale('nb')
            const time = fromHours.split(':')
            const hours = time[0]
            const minutes = time[1]
            const date1 = moment(fromDate, 'DD-MM-YYYY').toDate() // new Date(args[0])
            date1.setHours(Number(hours))
            date1.setMinutes(Number(minutes))
            const date2 = moment(toDate, 'DD-MM-YYYY').toDate()
            const feireObj: ferieItem = {
                fromDate: date1,
                toDate: date2,
            }
            const maxNumDays = 250
            if (DateUtils.isDateBefore(date1, date2) && DateUtils.dateIsMaxXDaysInFuture(date2, maxNumDays)) {
                DatabaseHelper.setFerieValue(interaction.user.id, 'date', JSON.stringify(feireObj))
                this.messageHelper.replyToInteraction(interaction, `Ferien din er satt`, true)
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
            const vacayNowMap: Map<Date, string> = new Map<Date, string>()
            const vacayLaterMap: Map<Date, string> = new Map<Date, string>()
            const ferieDates = DatabaseHelper.getAllFerieValues()
            /** Finn alle ferier og print dem hvis de er gyldige */
            Object.keys(ferieDates).forEach((username) => {
                if (DatabaseHelper.getNonUserValue('ferie', username)?.date) {
                    const ferieEle = JSON.parse(DatabaseHelper.getNonUserValue('ferie', username).date) as ferieItem
                    const date1 = moment(new Date(ferieEle.fromDate), 'DD-MM-YYYY').toDate()
                    const date2 = moment(new Date(ferieEle.toDate), 'DD-MM-YYYY').toDate()
                    if (!DateUtils.dateHasPassed(date2)) {
                        /**
                         * TODO: This has to be refactored, it's basically the same codeblock twice
                         */
                        if (DateUtils.dateHasPassed(date1)) {
                            const timeRemaining = DateUtils.getTimeTo(date2)

                            const dayString = timeRemaining?.days > 0 ? `${timeRemaining.days} dager, ` : ''
                            const hourString = timeRemaining?.hours > 0 ? `${timeRemaining.hours} timer og ` : ''
                            const timeUntilString = `${dayString}${hourString}${timeRemaining?.minutes ?? 0} min`
                            const vacayString = `- ${UserUtils.findUserById(username, interaction).username}: ${timeUntilString} igjen *(${DateUtils.formatDate(
                                date2
                            )})*\n`
                            vacayNowMap.set(date2, vacayString)
                        } else {
                            const timeRemaining = DateUtils.getTimeTo(date1)
                            const vacationLength = DateUtils.findDaysBetweenTwoDates(date1, date2)
                            const dayString = timeRemaining.days > 0 ? `${timeRemaining.days} dager, ` : ''
                            const hourString = timeRemaining.hours > 0 ? `${timeRemaining.hours} timer og ` : ''
                            const timeUntilString = `${dayString}${hourString}${timeRemaining.minutes} min`
                            const vacayString = `- ${UserUtils.findUserById(username, interaction).username}: om ${timeUntilString} *(${DateUtils.formatDate(
                                date1
                            )}, ${vacationLength} dager ferie)*\n`
                            vacayLaterMap.set(date1, vacayString)
                        }
                    }
                }
            })

            if (vacayNowMap.size < 1 && vacayLaterMap.size < 1) {
                return this.messageHelper.replyToInteraction(interaction, `Ingen har ferie lenger :(`)
            }
            let vacayNow = ''
            let vacayLater = ''
            let vacayNowSorted = new Map([...vacayNowMap].sort((d1, d2) => d1[0].getTime() - d2[0].getTime()))
            vacayNowSorted.forEach((vacayString, key) => (vacayNow += vacayString))
            let vacayLaterSorted = new Map([...vacayLaterMap].sort((d1, d2) => d1[0].getTime() - d2[0].getTime()))
            vacayLaterSorted.forEach((vacayString, key) => (vacayLater += vacayString))

            const vacay = new EmbedBuilder().setTitle(`Ferie 🏝️`)
            if (vacayNowMap.size > 0) vacay.addFields({ name: 'Er på ferie 😎', value: `${vacayNow}`, inline: false })
            if (vacayLaterMap.size > 0) vacay.addFields({ name: 'Skal på ferie 🙏', value: `${vacayLater}`, inline: false })
            this.messageHelper.replyToInteraction(interaction, vacay)
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
            const dateTab = dato.split('-').reverse().join('-')

            const cdDate = moment(dateTab + ' ' + timestamp + ':00')

            if (!cdDate.isValid() || DateUtils.dateHasPassed(cdDate.toDate())) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    `  'Du har skrevet inn en ugyldig dato eller klokkeslett. <dd-mm-yyyy> <HH> <beskrivelse>. Husk at time er nødvendig - minutt og sekund frivillig (HH:MM:SS)'.`
                )
            }
            if (this.userHasMaxCountdowns(interaction.user.id)) {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Du kan ha maks 3 countdowns. Bruk /countdown sett med teksten "fjern" for å fjerne alle, eller vent til de går ut.`
                )
            } else {
                const cds = DatabaseHelper.getCountdowns()
                const cdItem: ICountdownItem = {
                    date: cdDate.toDate(),
                    description: event,
                    ownerId: interaction.user.id,
                }
                cds.allCountdowns.push(cdItem)
                DatabaseHelper.updateCountdowns(cds)

                this.messageHelper.replyToInteraction(interaction, `Din countdown for *${event}* er satt til ${cdDate.toLocaleString()}`)
            }
        } else if (isPrinting) {
            let sendThisText = ''

            const countdowns = DatabaseHelper.getCountdowns()

            const printValues: dateValPair[] = []
            if (countdowns?.allCountdowns?.length < 1) {
                return this.messageHelper.replyToInteraction(interaction, `Det er ingen aktive countdowns`)
            }
            countdowns.allCountdowns.forEach((cd) => {
                const daysUntil = DateUtils.getTimeTo(new Date(cd.date))
                const text = DateUtils.formatCountdownText(daysUntil, 'te ' + cd.description)
                printValues.push({
                    print: `${!!text ? '\n' : ''}` + `${DateUtils.formatCountdownText(daysUntil, 'te ' + cd.description)}`,
                    date: cd.date,
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

    private userHasMaxCountdowns(userId: string) {
        const cds = DatabaseHelper.getCountdowns()
        return cds.allCountdowns.filter((c) => c.ownerId === userId).length >= 2
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
        console.log(holidays)
        let hasHolidayInTheMiddleOfWeek = ''
        if (!isHelg) {
            let hasFoundWeekendStart = false
            holidays.forEach((day) => {
                if (!hasFoundWeekendStart) {
                    const currentDaysDate = new Date(day.date)

                    if (currentDaysDate.getDay() === this.findWeekendStart()?.getDay()) {
                        hasFoundWeekendStart = true
                        timeUntil += `${DateUtils.formatCountdownText(DateUtils.getTimeTo(currentDaysDate), `til langhelgå så starte med ${day.name}`)}\n`
                    } else
                        hasHolidayInTheMiddleOfWeek = timeUntil = `${DateUtils.formatCountdownText(
                            DateUtils.getTimeTo(currentDaysDate),
                            `til fridagen ${day.name}`
                        )}\n`
                }
            })
            console.log(timeUntil)

            if (!hasFoundWeekendStart) {
                const possibleWeekendStart = this.findWeekendStart()

                if (possibleWeekendStart) {
                    timeUntil += DateUtils.formatCountdownText(DateUtils.getTimeTo(possibleWeekendStart), 'til langhelg')
                } else {
                    const doesNextWeekHaveHolidayOnMonday = this.nextWeekHasHolidayOnMonday()[0]
                    moment.locale('nb')
                    const date = moment()
                    const isFriday = date.day() === 5
                    const isAfter16 = date.hours() >= 16
                    const nextWeekendStart = moment(DateUtils.nextWeekdayDate(5))
                    nextWeekendStart.hours(16).minutes(0).seconds(0)
                    date.hours(16).minute(0).seconds(0)

                    const timeTo = DateUtils.getTimeTo(isFriday ? date : nextWeekendStart)
                    const isLessThan4HoursAway = timeTo?.days == 0 && timeTo?.hours < 4
                    const emoji = EmojiHelper.getHelgEmoji(this.client, isLessThan4HoursAway)

                    if (isFriday && isAfter16) return 'Det e helg!'

                    const textToPrint = `til ${doesNextWeekHaveHolidayOnMonday ? `langhelg! (${doesNextWeekHaveHolidayOnMonday.name})` : 'helg'} ${emoji}`

                    let timeToPrint = DateUtils.formatCountdownText(timeTo, textToPrint) || 'Eg vettkje ka dag det e :('
                    if (!!hasHolidayInTheMiddleOfWeek && !this.isTodayHoliday()) {
                        timeToPrint += `\n${hasHolidayInTheMiddleOfWeek}`
                    }
                    if (this.isTodayHoliday()) {
                        return 'Det e fridag i dag! Og ' + timeToPrint
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
                const timeUntilBirthday = DateUtils.formatCountdownText(
                    DateUtils.getTimeTo(date),
                    `til ${interaction.user.username} sin bursdag.`,
                    undefined,
                    true
                )
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
        const today = moment()
        if (today.day() == 6 || today.day() == 0) return true
        else if (today.day() == 5 && today.hours() > 16) return true
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
