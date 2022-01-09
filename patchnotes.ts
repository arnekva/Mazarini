import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes {
    public static readonly currentVersion = '3.14.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `*  Fikset tekst for Legg til Quote (2 -> 3)` +
        `\n* '!mz aktivitet' rapporterer nå alle aktiviteter til en bruker` +
        `\n* '!mz krig' bruker nå ReactionCollector for øyeblikkelige handlinger i stedet for å måtte vente 60 sek.` +
        `\n* Botten skal ikke lenger rapportere endringer på seg selv i Action Log` +
        `\n* Senket sannsynligheten for at botten ikke "orker" å gjøre en command` +
        `\n* Gjort en større refaktorering av index.ts` +
        `\n* Opprettet CommandRunner, DailyJobs og WeeklyJobs klasser` +
        `\n* Laget flere hjelpemetoder i MessageHelper for å reagere med emojies` +
        `\n* Lagt til ekstra feilhåndtering for deletemessages når det når fetch/cache limit`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }

    static readonly getPatchNotes: ICommandElement = {
        commandName: 'patch',
        description: 'Vis nyligste patch notes',

        command: (rawMessage: Message, messageContent: string) => {
            const pn = PatchNotes.getCurrentPatchNotes()
            MessageHelper.sendMessage(rawMessage, pn)
        },
        category: 'annet',
    }

    static readonly publishPatchNotes: ICommandElement = {
        commandName: 'publishnotes',
        description: 'Vis nyligste patch notes',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            MessageFlags
            const pn = PatchNotes.getCurrentPatchNotes()
            MessageHelper.sendMessageToSpecificChannel('802716150484041751', pn, rawMessage.channel as TextChannel)
        },
        category: 'admin',
    }
}
