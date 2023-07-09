const reset = '\x1b[0m'; // Reset ANSI styles

/**
 * Applies red color to the given text.
 * @param {string} text - The text to be colorized.
 * @returns {string} The colorized text.
 */
export function red(text: string) {
  return `\x1b[31m${text}${reset}`;
}

/**
 * Applies green color to the given text.
 * @param {string} text - The text to be colorized.
 * @returns {string} The colorized text.
 */
export function green(text: string) {
  return `\x1b[32m${text}${reset}`;
}

/**
 * Applies yellow color to the given text.
 * @param {string} text - The text to be colorized.
 * @returns {string} The colorized text.
 */
export function yellow(text: string) {
  return `\x1b[33m${text}${reset}`;
}

/**
 * Applies blue color to the given text.
 * @param {string} text - The text to be colorized.
 * @returns {string} The colorized text.
 */
export function blue(text: string) {
  return `\x1b[34m${text}${reset}`;
}

/**
 * Applies magenta color to the given text.
 * @param {string} text - The text to be colorized.
 * @returns {string} The colorized text.
 */
export function magenta(text: string) {
  return `\x1b[35m${text}${reset}`;
}
