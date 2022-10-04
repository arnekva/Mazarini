import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '10.0.0'
    public static readonly nextVersion = '10.0.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    private static readonly headerNextRelease = 'Endringer som kommer i neste release ' + PatchNotes.nextVersion

    public static readonly currentPatchNotes: string =
        `\n* De aller fleste !mz-kommandoer slutter nå å fungere. Noen admin-funksjoner eksisterer fremdeles` +
        `\n* /snakk sier ikke lenger hva du fikk botten til å si for alle - den svarer kun deg` +
        `\n* Du kan nå få rebirth only stats for wz med /stats rebirth` +
        `\n* Ferie er nå slashcommand` +
        `\n* Sang er nå slashcommand` +
        `\n* uwu er nå slashcommand` +
        `\n* rulett er nå slashcommand` +
        `\n* Meme er nå slashcommand` +
        `\n* /pullrequest er en ny slashcommand` +
        `\n* Status er nå splittet i to subcommands for forbedret brukeropplevelse (looking at you ${MentionUtils.mentionUser(
            '239154365443604480'
        )}); /status vis og /status sett. ` +
        `\n* Du kan nå se saker som kommer i neste release ved å bruke /backlog` +
        `\n* Meme burde nå gi bedre feilmeldinger hvis requestene feiler` +
        `\n* botstatus er nå slashcommand (admin)` +
        `\n* reply er nå slashcommand  (admin)` +
        `\n* publishnotes er nå slashcommand (admin). Publiserer patch notes til ${MentionUtils.mentionChannel(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING)}` +
        `\n* stopprocess er nå slashcommand (admin). Denne vil forsøke å stanse prod-botten` +
        `\n* /lock er nå slashcommand (admin). Adminer kan alltid by-passe locks. ` +
        `\n* Låsing gjelder nå også passive funksjoner som pølse ` +
        `\n* countdown lagrer nå verdien på ID i stedet for brukernavn` +
        `\n* Endret måten /Spotify håndterer søket på; før valgte den bare første resultat, men den vil nå lete gjennom resultatene til den finner matchende artistnavn. Hvis ingen finnes vil den ikke sende med ekstra data` +
        `\n* Quote er fjernet` +
        `\n* React er fjernet` +
        `\n* "Kan" kommandoen er fjernet, og er erstattet med en "pølse"-lignende effekt. Meldingen må starte med "Kan".` +
        `\n* Du kan nå sjekke andre personer sine stats med /stats <mode> <bruker?>` +
        `\n* countdown skal nå printe en finere timestamp når du setter den` +
        `\n* countdown skal nå printe hendelsesteksten i bekreftelsesmeldingen` +
        `\n* Ryddet opp i funksjoner i messageHelper` +
        `\n* Ryddet opp i funksjoner i databaseHelper` +
        `\n* ID-er for roller og channels er nå samlet i MentionUtils` +
        `\n* ID-er for roller og channels er nå markert som deprecated i MessageUtils og UserUtils i stedet for å ble fjerna siden Arne e for lat te å endra patchnotene som allerede bruke verdiene fra de to` +
        `\n* Prod-bot skal ikke lenger svare på interactions i ${MentionUtils.mentionChannel(MessageUtils.CHANNEL_IDs.LOKAL_BOT_SPAM)} hvis testbotten kjører` +
        `\n* Flere npm dependencies er fjernet` +
        `\n* Flere hooks i main er fjernet` +
        `\n* Oppdatert flere tekster som refererte til !mz-kommandoer til å nå vise til slashcommandoene` +
        `\n* Lagt til funksjoner som skal forsøke å fange flere feil som blir kastet av interaksjonene` +
        `\n* Fikset en feil som tillot flere enn én countdown hvis du endret brukernavn` +
        `\n* Flere databaseinnlegg, deriblant incorrectCommands er fjernet` +
        `\n* Sjekker ikke lenger for kommandoer på messageCreate eller messageUpdate` +
        `\n* Locking er flyttet til LockingManager, som nå håndterer locking. Låsing lagres ikke persistant.` +
        `\n* MessageHelper sin replyToInteraction skal nå gjøre et bedre forsøk på å ikke besvare en interaksjon to ganger` +
        `\n* Botstatus skal nå vise korrekt verdi i loggen for hvilken enum som blir satt til verdi. (Logger nå navn på enum i stedet for verdien)`

    public static readonly nextPatchNotes: string = `\n* Ingenting er planlagt for release enda`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }
    static getNextReleasePatchNotes() {
        return PatchNotes.headerNextRelease + '\n' + PatchNotes.nextPatchNotes
    }

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    public getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'patchnotes',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getCurrentPatchNotes())
                },
                category: 'annet',
            },
            {
                commandName: 'backlog',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getNextReleasePatchNotes())
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
                    this.messageHelper.replyToInteraction(
                        rawInteraction,
                        `Patch notes sendt til ${MentionUtils.mentionChannel(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING)}`,
                        true
                    )
                },
                category: 'annet',
            },
        ]
    }
}
