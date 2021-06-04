import * as cleanTextUtils from 'clean-text-utils';

export function escapeString(text: string) {
	let cleanKey = cleanTextUtils.strip.nonASCII(text);
	// cleanKey = cleanTextUtils.replace.exoticChars(text);
	return cleanKey;
}

export function isUpperCase(str: string) {
	return str === str.toUpperCase();
}