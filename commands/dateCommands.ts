import { CacheType, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { HelgHelper } from '../helpers/helgHelper'
import { ICountdownItem, ferieItem } from '../interfaces/database/databaseInterface'
import { IInteractionElement } from '../interfaces/interactionInterface'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils, dateRegex, timeRegex } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'
import { DatabaseHelper } from '../helpers/databaseHelper'

export interface dateValPair {
    print: string
    date: string | Date
}

export class DateCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }
    private setReminder(interaction: ChatInputCommandInteraction<CacheType>) {
        const timeArray = (interaction.options.get('tid')?.value as string).split(':')
        const event = interaction.options.get('tekst')?.value as string

        const hoursInMilli = Number(timeArray[0]) * 3600 * 1000
        const minInMilli = Number(timeArray[1]) * 60000
        const secInMilli = Number(timeArray[2]) * 1000
        const timeout = hoursInMilli + minInMilli + secInMilli
        if (timeArray.length < 3) {
            this.messageHelper.replyToInteraction(interaction, 'Formattering på tid må være HH:MM:SS', { ephemeral: true })
        } else if (event.length < 1) {
            this.messageHelper.replyToInteraction(interaction, 'Du må spesifisere hva påminnelsen gjelder', { ephemeral: true })
        } else {
            this.messageHelper.replyToInteraction(
                interaction,
                `Påminnelsen din er satt for *${event}* om *${timeArray[0] ? timeArray[0] + ' timer, ' : ''} ${timeArray[1]} minutter og ${
                    timeArray[2]
                } sekunder*`
            )
            setTimeout(() => {
                this.messageHelper.sendMessage(interaction?.channelId, {
                    text: `***Påminnelse for ${MentionUtils.mentionUser(interaction.user.id)}***\n*${event}*`,
                })
            }, timeout)
        }
    }

    //TODO: Fix this one
    private async registerFerie(interaction: ChatInputCommandInteraction<CacheType>) {
        const isSet = interaction.options.getSubcommand() === 'sett'
        const isVis = interaction.options.getSubcommand() === 'vis'
        const fromDate = interaction.options.get('fra-dato')?.value as string
        const toDate = interaction.options.get('til-dato')?.value as string
        const fromHours = interaction.options.get('fra-klokkeslett')?.value as string
        const storage = await this.client.db.getStorage()
        let ferier = storage?.ferie
        if (!ferier) ferier = []
        if (fromDate === 'fjern' || toDate === 'fjern') {
            ferier = ferier.filter((f) => f.id !== interaction.user.id)
            this.client.db.updateStorage({ ferie: ferier })
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
                    { ephemeral: true }
                )
            }
            if (!isLegalTime) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    `Klokkeslettet ditt er ikke formattert riktig. Det må være i formatet HH:MM (eksempelvis 17:30)`,
                    { ephemeral: true }
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
                let hasFerie = ferier.find((f) => f.id === interaction.user.id)
                if (hasFerie) hasFerie.value = feireObj
                else
                    ferier.push({
                        id: interaction.user.id,
                        value: feireObj,
                    })
                this.client.db.updateStorage({ ferie: ferier })
                this.messageHelper.replyToInteraction(interaction, `Ferien din er satt`, { ephemeral: true })
            } else {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Dato 1 må være før dato 2, og ferie kan maks settes til ${maxNumDays} dager frem i tid fra nåværende dato`
                )
            }
        } else {
            const vacayNowMap: Map<Date, string> = new Map<Date, string>()
            const vacayLaterMap: Map<Date, string> = new Map<Date, string>()
            const storage = await this.client.db.getStorage()
            const ferier = storage?.ferie
            if (!ferier) return this.messageHelper.replyToInteraction(interaction, `Ingen har ferie i nærmeste fremtid`)
            /** Finn alle ferier og print dem hvis de er gyldige */
            ferier.forEach((ferie) => {
                if (ferie.value) {
                    const ferieEle = ferie.value
                    const date1 = moment(new Date(ferieEle.fromDate), 'DD-MM-YYYY').toDate()
                    const date2 = moment(new Date(ferieEle.toDate), 'DD-MM-YYYY').toDate()
                    if (!DateUtils.dateHasPassed(date2)) {
                        const isDuring = DateUtils.dateHasPassed(date1)
                        const vacationLength = DateUtils.findDaysBetweenTwoDates(date1, date2)
                        const timeRemaining = isDuring ? DateUtils.getTimeTo(date2) : DateUtils.getTimeTo(date1)
                        const username = UserUtils.findUserById(ferie.id, interaction).username

                        const dayString = timeRemaining?.days > 0 ? `${timeRemaining.days} dager, ` : ''
                        const hourString = timeRemaining?.hours > 0 ? `${timeRemaining.hours} timer og ` : ''
                        const timeUntilString = `${dayString}${hourString}${timeRemaining?.minutes ?? 0} min`
                        const vacayString =
                            `- ${username}: ` +
                            (isDuring
                                ? `${timeUntilString} igjen *(${DateUtils.formatDate(date2)})*\n`
                                : `om ${timeUntilString} *(${DateUtils.formatDate(date1)}, ${vacationLength} dager ferie)*\n`)
                        if (isDuring) vacayNowMap.set(date2, vacayString)
                        else vacayLaterMap.set(date2, vacayString)
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
        const tags = interaction.options.get('tags')?.value as string
        const storage = await this.client.db.getStorage()
        let countdowns = storage?.countdown
        if (!countdowns)
            countdowns = {
                allCountdowns: [],
            }
        if (isNewCountdown) {
            if (event == 'fjern') {
                this.messageHelper.replyToInteraction(interaction, `Fjernet countdownen din`, { ephemeral: true })
                const ownersCountdown = countdowns.allCountdowns.find((c) => c.ownerId === interaction.user.id)
                if (ownersCountdown) {
                    ArrayUtils.removeItemOnce(countdowns.allCountdowns, ownersCountdown)
                    this.client.db.updateStorage({ countdown: countdowns })
                    return true
                }
                return false
            }
            const isLegal = dateRegex.test(dato)
            if (!isLegal) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    'du må formattere datoen ordentlig (dd-mm-yyyy). Hvis du bare prøve å se aktive countdowns, bruk /countdown vis',
                    { ephemeral: true }
                )
            }
            const dateTab = dato.split('-').reverse().join('-')

            const cdDate = moment(dateTab + 'T' + timestamp + ':00')

            if (!cdDate.isValid() || DateUtils.dateHasPassed(cdDate.toDate())) {
                return this.messageHelper.replyToInteraction(
                    interaction,
                    `  'Du har skrevet inn en ugyldig dato eller klokkeslett. <dd-mm-yyyy> <HH> <beskrivelse>. Husk at time er nødvendig - minutt og sekund frivillig (HH:MM:SS)'.`,
                    { ephemeral: true }
                )
            }
            if (await this.userHasMaxCountdowns(interaction.user.id)) {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Du kan ha maks 3 countdowns. Bruk /countdown sett med teksten "fjern" for å fjerne alle, eller vent til de går ut.`,
                    { ephemeral: true }
                )
            } else {
                const tagTab = tags.split(',')
                const cdItem: ICountdownItem = {
                    date: cdDate.toDate(),
                    description: event,
                    ownerId: interaction.user.id,
                    tags: tagTab,
                }
                countdowns.allCountdowns.push(cdItem)
                this.client.db.updateStorage({ countdown: countdowns })
                this.messageHelper.replyToInteraction(interaction, `Din countdown for *${event}* er satt til ${cdDate.toLocaleString()}`, { ephemeral: true })
            }
        } else if (isPrinting) {
            let sendThisText = ''

            const printValues: dateValPair[] = []
            if (countdowns?.allCountdowns?.length < 1) {
                return this.messageHelper.replyToInteraction(interaction, `Det er ingen aktive countdowns`)
            }
            countdowns.allCountdowns.forEach((cd) => {
                const daysUntil = DateUtils.getTimeTo(new Date(cd.date))
                const text = DateUtils.formatCountdownText(daysUntil, 'te ' + cd.description)
                printValues.push({
                    print:
                        `${!!text ? '\n' : ''}` +
                        `${DateUtils.formatCountdownText(daysUntil, 'te ' + cd.description)} *(${DateUtils.formatDate(new Date(cd.date), true)})*`,
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

    private checkForHelg(interaction: ChatInputCommandInteraction<CacheType>) {
        HelgHelper.checkForHelg(interaction, this.client)
    }

    private async userHasMaxCountdowns(userId: string) {
        const storage = await this.client.db.getStorage()
        const cds = storage?.countdown
        if (!cds) return false
        return cds.allCountdowns.filter((c) => c.ownerId === userId).length >= 3
    }

    private async addUserBirthday(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.db.getUser(interaction.user.id)
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
                this.messageHelper.replyToInteraction(interaction, `Formatteringen din er feil (${dateString}). Det må formatteres dd-mm-yyyy`, {
                    ephemeral: true,
                })
            } else {
                user.birthday = dateString
                this.client.db.updateUser(user)
                this.messageHelper.replyToInteraction(interaction, `Satte bursdagen din til ${dateString}`)
            }
        } else {
            this.messageHelper.replyToInteraction(
                interaction,
                `Du har ikke satt bursdagen din. Legg ved datoen formattert dd-mm-yyyy som argument når du kaller /bursdag neste gang`,
                { ephemeral: true }
            )
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
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
                ],
            },
        }
    }
}
