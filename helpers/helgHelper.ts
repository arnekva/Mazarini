import { ChatInputCommandInteraction, CacheType } from 'discord.js'
import moment from 'moment'
import { DateCommands } from '../commands/dateCommands'
import { DateUtils } from '../utils/dateUtils'
import { EmojiHelper } from './emojiHelper'
import { MazariniClient } from '../client/MazariniClient'
const holidays = require('holidays-norway').default

export namespace HelgHelper {
    //TODO: Refactor out of here
    export const isItHelg = () => {
        const today = moment()
        if (today.day() == 6 || today.day() == 0) return true
        else if (today.day() == 5 && today.hours() > 16) return true
        return false
    }

    export const isInWeekend = (date: Date) => {
        const dayOfWeek = date.getDay()
        return dayOfWeek === 6 || dayOfWeek === 0
    }

    export const findWeekendStart = (): Date | undefined => {
        const holidays = HelgHelper.findHolidaysInThisWeek()
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

    export const isTodayHoliday = () => {
        const h = HelgHelper.findHolidaysInThisWeek()
        return !!h.find((d) => new Date(d.date).getDay() === new Date().getDay())
    }

    export const nextWeekHasHolidayOnMonday = () => {
        const mondayHoliday = HelgHelper.findHolidaysInThisWeek(true)
        return mondayHoliday
    }

    export const getTimeUntilHelgString = async (includeEmoji?: MazariniClient) => {
        const isHelg = HelgHelper.isItHelg()
        const holidays = HelgHelper.findHolidaysInThisWeek()
        let timeUntil = ''
        let hasHolidayInTheMiddleOfWeek = ''
        if (!isHelg) {
            let hasFoundWeekendStart = false
            holidays.forEach((day) => {
                if (!hasFoundWeekendStart) {
                    const currentDaysDate = new Date(day.date)

                    if (currentDaysDate.getDay() === HelgHelper.findWeekendStart()?.getDay()) {
                        hasFoundWeekendStart = true
                        timeUntil += `${DateUtils.formatCountdownText(DateUtils.getTimeTo(currentDaysDate), `til langhelgå så starte med ${day.name}`)}\n`
                    } else
                        hasHolidayInTheMiddleOfWeek = timeUntil = `${DateUtils.formatCountdownText(
                            DateUtils.getTimeTo(currentDaysDate),
                            `til fridagen ${day.name}`
                        )}\n`
                }
            })
            if (!hasFoundWeekendStart) {
                const possibleWeekendStart = HelgHelper.findWeekendStart()

                if (possibleWeekendStart) {
                    timeUntil += DateUtils.formatCountdownText(DateUtils.getTimeTo(possibleWeekendStart), 'til langhelg')
                } else {
                    const doesNextWeekHaveHolidayOnMonday = HelgHelper.nextWeekHasHolidayOnMonday()[0]
                    moment.locale('nb')
                    const date = moment()
                    const isFriday = date.day() === 5
                    const isAfter16 = date.hours() >= 16
                    const nextWeekendStart = moment(DateUtils.nextWeekdayDate(5))
                    nextWeekendStart.hours(16).minutes(0).seconds(0)
                    date.hours(16).minute(0).seconds(0)

                    const timeTo = DateUtils.getTimeTo(isFriday ? date : nextWeekendStart)
                    const isLessThan4HoursAway = timeTo?.days == 0 && timeTo?.hours < 4
                    const emoji = includeEmoji ? EmojiHelper.getHelgEmoji(includeEmoji, isLessThan4HoursAway) : ''
                    if (isFriday && isAfter16) return `Det e helg!`

                    const textToPrint = `til ${doesNextWeekHaveHolidayOnMonday ? `langhelg! (${doesNextWeekHaveHolidayOnMonday.name})` : 'helg'} ${emoji}`

                    let timeToPrint = DateUtils.formatCountdownText(timeTo, textToPrint) || 'Eg vettkje ka dag det e :('
                    if (!!hasHolidayInTheMiddleOfWeek && !HelgHelper.isTodayHoliday()) {
                        timeToPrint += `\n${hasHolidayInTheMiddleOfWeek}`
                    }
                    if (HelgHelper.isTodayHoliday()) {
                        return 'Det e fridag i dag! Og ' + timeToPrint
                    }
                    return timeToPrint
                }
            }
        }
        return timeUntil
    }

    export const findHelgeFolelse = () => {
        const day = moment().day()
        if (day === 6) return 100
        else if (day === 0) return HelgHelper.getHelgFolelseDuringSunday()
        else return HelgHelper.getHelgFolelseDuringWeekday()
    }

    export const getHelgFolelseDuringWeekday = () => {
        const date = moment()
        const day = date.day() - 1
        const hours = date.hour()
        const minutes = date.minute()
        const currentMinute = (day * 24 + hours) * 60 + minutes
        const input = currentMinute * 0.0148
        let percentage = +(((input - 20) ** 3 / 10000) * 2).toFixed(2)
        if (percentage < 90) percentage = Math.floor(percentage)
        return Math.max(Math.min(percentage, 100), 0)
    }

    export const getHelgFolelseDuringSunday = () => {
        const date = moment()
        const hours = date.hour()
        const minutes = date.minute()
        const currentMinute = hours * 60 + minutes
        const input = currentMinute * 0.0694
        const percentage = Math.floor(((-input + 10) ** 3 / 10000) * 2 + 100)
        return Math.max(Math.min(percentage, 100), 0)
    }

    export const checkForHelg = async (interaction?: ChatInputCommandInteraction<CacheType>, client?: MazariniClient) => {
        const isHelg = HelgHelper.isItHelg()
        const helgeFolelse = HelgHelper.findHelgeFolelse()
        const val = (await isHelg) ? `Det e helg!` : `${await HelgHelper.getTimeUntilHelgString(client)}`
        if (interaction && client) client.messageHelper.replyToInteraction(interaction, val + ` (${helgeFolelse}% helgefølelse)`)
        return val + ` (${helgeFolelse}% helgefølelse)`
    }

    export const findHolidaysInThisWeek = (checkForNextWeeksMonday?: boolean) => {
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
                    if (!HelgHelper.isInWeekend(date)) holidaysThisWeek.push(day)
                }
            }
        })

        /** set locale back to nb */
        moment.locale('nb')
        return holidaysThisWeek
    }
}