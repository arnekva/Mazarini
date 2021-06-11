
import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message } from "discord.js";
import { ICommandElement } from "./commands/commands";
import { MessageHelper } from "./helpers/messageHelper";
export class PatchNotes {

	/** Version x.y.z
	 * Increment x for store oppdateringer (inkl. endringer med breaking changes, større refactoring osv.)
	 * Increment y for mindre oppdateringer (enkle funksjoner osv)
	 * Increment z for bugfixes, mindre tekstendringer, sannsynlighetsendringer etc
	 */
	public static readonly currentVersion = "2.3.0";

	/** Private, brukes kun av getCurrentPatchNotes */
	private static readonly header = "Patch notes for versjon " + PatchNotes.currentVersion;

	/** Separer hver linje med \n (linebreak), og start med en stjerne (*). Skriv generelt hva som er endret
	 * Eks: Senket sannsynligheten for å få høye tall på spinneren
	 * Ikke: Endret sannsynligheten for å få 10 på spinner fra 0.001 til 0.0025, og 9 fra 0.002 til 0.0025 		osv. 
	 */
	public static readonly currentPatchNotes: string
		= "* Du kan nå knytte Last.FM brukeren din til Discord brukernavnet ditt, og hente ut topp 10 artister (flere funksjoner er under utvikling) med funksjonen !mz music top10 etter tilknytting"
		+ "* Rettet en bug i Warzone stats, som nå skal gi ordentlig feilmelding dersom noe går galt. "


		// + "\n* Boten gir nå beskjed når den er i utviklingsmodus, og at databaseverdier ikke blir lagret når aktivt."
		+ "\n*Tekniske Notes*" //Kommenter ut denne og det under hvis det ikke er noen tekniske notes
		+ "\n* Music-klassen er opprettet for å håndtere musikk-relaterte kommandoer. " //Kommenter ut denne og det under hvis det ikke er noen tekniske notes
		;

	static getCurrentPatchNotes() {
		return PatchNotes.header + "\n" + PatchNotes.currentPatchNotes;
	}

	static readonly getPatchNotes: ICommandElement = {
		commandName: "patch",
		description: "Vis nyligste patch notes",

		command: (rawMessage: Message, messageContent: string) => {
			const pn = PatchNotes.getCurrentPatchNotes();
			MessageHelper.sendMessage(rawMessage, pn)
		}
	}

	static readonly publishPatchNotes: ICommandElement = {
		commandName: "publishnotes",
		description: "Vis nyligste patch notes",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			const pn = PatchNotes.getCurrentPatchNotes();
			MessageHelper.sendMessageToSpecificChannel("802716150484041751", pn, rawMessage.channel as TextChannel)
		}
	}
}