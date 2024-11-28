import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import moment from 'moment'
import { MazariniClient } from '../client/MazariniClient'
import { Holidays } from '../general/misc/holidays'
import { countdownTime, DateUtils } from '../utils/dateUtils'
import { EmojiHelper } from './emojiHelper'

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

    export const getTimeUntilHelgString = (includeEmoji?: MazariniClient) => {
        const isHelg = HelgHelper.isItHelg()
        const holidays = HelgHelper.findHolidaysInThisWeek()
        let timeUntil = ''
        let hasHolidayInTheMiddleOfWeek = ''

        let hasFoundWeekendStart = false
        holidays.forEach((day) => {
            if (!hasFoundWeekendStart) {
                const currentDaysDate = new Date(day.date)

                if (currentDaysDate.getDay() === HelgHelper.findWeekendStart()?.getDay()) {
                    hasFoundWeekendStart = true
                    timeUntil += `${DateUtils.formatCountdownText(DateUtils.getTimeTo(currentDaysDate), {
                        textEnding: `til langhelgå så starte med ${day.name}`,
                    })}\n`
                } else
                    hasHolidayInTheMiddleOfWeek = timeUntil = `${DateUtils.formatCountdownText(DateUtils.getTimeTo(currentDaysDate), {
                        textEnding: `til fridagen ${day.name}`,
                        includeLinebreak: true,
                    })}`
            }
        })
        if (!hasFoundWeekendStart) {
            const possibleWeekendStart = HelgHelper.findWeekendStart()

            if (possibleWeekendStart) {
                timeUntil += DateUtils.formatCountdownText(DateUtils.getTimeTo(possibleWeekendStart), { textEnding: 'til langhelg' })
            } else {
                const doesNextWeekHaveHolidayOnMonday = HelgHelper.nextWeekHasHolidayOnMonday()[0]
                moment.locale('nb')
                const date = moment()
                const isFriday = date.day() === 5
                const isAfter16 = date.hours() >= 16
                const nextWeekendStart = moment(DateUtils.nextWeekdayDate(5))
                const isHoliday = HelgHelper.isTodayHoliday()
                nextWeekendStart.hours(16).minutes(0).seconds(0)
                date.hours(16).minute(0).seconds(0)

                const timeTo = DateUtils.getTimeTo(isFriday ? date : nextWeekendStart)
                const isLessThan4HoursAway = timeTo?.days == 0 && timeTo?.hours < 4
                const emoji = includeEmoji ? EmojiHelper.getHelgEmoji(includeEmoji, isLessThan4HoursAway) : ''
                if (isFriday && isAfter16) return `Det e ${doesNextWeekHaveHolidayOnMonday ? `langhelg (${doesNextWeekHaveHolidayOnMonday.name})` : 'helg'}!`
                if (isHelg) return `Det e helg!`
                const textToPrint = `til ${doesNextWeekHaveHolidayOnMonday ? `langhelg! (${doesNextWeekHaveHolidayOnMonday.name})` : 'helg'} ${emoji}`

                let timeToPrint = DateUtils.formatCountdownText(timeTo, { textEnding: textToPrint }) || 'Eg vettkje ka dag det e :('
                if (hasHolidayInTheMiddleOfWeek !== '' && !isHoliday) {
                    timeToPrint += `\n${hasHolidayInTheMiddleOfWeek}`
                }
                if (isHoliday) {
                    return 'Det e fridag i dag! Og ' + timeToPrint
                }
                return timeToPrint
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
        const seconds = date.second()
        const currentSecond = ((day * 24 + hours) * 60 + minutes) * 60 + seconds
        const input = currentSecond * 0.00024645365
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
        const helgeFolelse = HelgHelper.findHelgeFolelse()
        const val = `${await HelgHelper.getTimeUntilHelgString(client)}`
        if (interaction && client) client.messageHelper.replyToInteraction(interaction, val + ` (${helgeFolelse}% helgefølelse)`)

        return val + ` (${helgeFolelse}% helgefølelse)`
    }

    export const findHolidaysInThisWeek = (checkForNextWeeksMonday?: boolean) => {
        moment.locale('en')

        const currentWeekIsLastInYear = moment().week() === moment().weeksInYear()
        const year = new Date().getFullYear() + (currentWeekIsLastInYear && checkForNextWeeksMonday ? 1 : 0)
        const holidaysFromYear = Holidays.getNorwegianPublicHolidays(year)

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

    export interface IHolidayCheck {
        holidayName: string
        keywords: string[]
        holidayStart: string
        countdownHourOffset: number
        printEnd: string
    }

    const holidayChecks: IHolidayCheck[] = [
        { holidayName: 'påske', keywords: ['påske', 'easter'], holidayStart: 'skjærtorsdag', printEnd: 'til påskeferie!', countdownHourOffset: -12 },
        {
            holidayName: 'kristi himmelfartsdag',
            keywords: ['kristi himmelfartsdag', 'himmelsprett', 'kristihimmelfartsdag'],
            holidayStart: 'kristi himmelfartsdag',
            printEnd: 'til Kristi Himmelfartsdag!',
            countdownHourOffset: 0,
        },
        { holidayName: 'pinse', keywords: ['pinse'], holidayStart: '2. pinsedag', printEnd: 'til 2. pinsedag (langhelg)!', countdownHourOffset: 0 },
        {
            holidayName: '17. mai',
            keywords: ['17. mai', 'nasjonaldag', '17mai', '17.mai', '17 mai'],
            holidayStart: '17. mai',
            printEnd: 'til 17. mai!',
            countdownHourOffset: 0,
        },
        {
            holidayName: 'arbeidernes dag',
            keywords: ['labour', 'labor', 'arbeider', '1.mai', '1. mai', '1mai', '1 mai'],
            holidayStart: '1. mai',
            printEnd: 'til arbeidernes dag!',
            countdownHourOffset: 0,
        },
        { holidayName: 'jul', keywords: ['jul', 'christmas'], holidayStart: '1. juledag', printEnd: 'til juleferie!', countdownHourOffset: -32 },
        { holidayName: 'nyttår', keywords: ['nyttår', 'new year', 'newyear'], holidayStart: 'nyttårsaften', printEnd: 'til nyttår!', countdownHourOffset: 24 },
    ]

    export const checkMessageForHolidays = (msg: string) => {
        let holiday: IHolidayCheck = holidayChecks.find((holiday) => holiday.keywords.some((keyword) => msg.toLowerCase() === keyword.toLowerCase()))
        if (!holiday && Math.random() < 1/4) holiday = holidayChecks.find((holiday) => holiday.keywords.some((keyword) => msg.toLowerCase().includes(keyword.toLowerCase())))
        if (holiday) {
            moment.locale('en')
            const year = new Date().getFullYear()
            let holidaysFromYear: { name: string; date: string }[] = Holidays.getNorwegianPublicHolidays(year)
            let holidayDateObject = holidaysFromYear.find((hdo) => hdo.name.toLowerCase() === holiday.holidayStart.toLowerCase())
            let date = new Date(holidayDateObject.date)
            date.setHours(date.getHours() + holiday.countdownHourOffset - 1) //subtracting 1h due to zulu time
            if (DateUtils.dateHasPassed(date)) {
                holidaysFromYear = Holidays.getNorwegianPublicHolidays(year + 1)
                holidayDateObject = holidaysFromYear.find((hdo) => hdo.name.toLowerCase() === holiday.holidayStart.toLowerCase())
                date = new Date(holidayDateObject.date)
                date.setHours(date.getHours() + holiday.countdownHourOffset - 1) //subtracting 1h due to zulu time
            }
            const countdownObj: countdownTime = DateUtils.getTimeTo(date)
            moment.locale('nb')
            return countdownObj ? DateUtils.formatCountdownText(countdownObj, { textEnding: holiday.printEnd }) : undefined
        }
        moment.locale('nb')
        return undefined
    }
}
