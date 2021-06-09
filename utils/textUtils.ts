import * as cleanTextUtils from 'clean-text-utils';

export function escapeString(text: string) {
	let cleanKey = cleanTextUtils.strip.nonASCII(text);
	// cleanKey = cleanTextUtils.replace.exoticChars(text);
	return cleanKey;
}

export function isUpperCase(str: string) {
	return str === str.toUpperCase();
}

export function msToTime(duration: number, onlyHours?: boolean) {
	var milliseconds = Math.floor((duration % 1000) / 100),
		seconds = Math.floor((duration / 1000) % 60),
		minutes = Math.floor((duration / (1000 * 60)) % 60),
		hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

	const newHours = (hours < 10) ? "0" + hours : hours;
	const newminutes = (minutes < 10) ? "0" + minutes : minutes;
	const newseconds = (seconds < 10) ? "0" + seconds : seconds;

	return onlyHours ? hours : newHours + ":" + newminutes + ":" + newseconds + "." + milliseconds;
}