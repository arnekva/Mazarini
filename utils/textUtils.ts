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
export function replaceLast(mainString: string, searchString: string, replaceWith: string) {
	var a = mainString.split("");
	a[mainString.lastIndexOf(searchString)] = replaceWith;
	return a.join("");
}

export const isInQuotation = (content: string) => {

            const matches = content.match(/"(.*?)"/);
            return matches
            ? matches[1]
            : content;
        }
export function getUsernameInQuotationMarks(content: string) {
    if(content.includes('"')){
           return  isInQuotation(content);
        } else {
            return undefined
        }
}