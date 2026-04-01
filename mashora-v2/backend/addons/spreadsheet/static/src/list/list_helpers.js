// @ts-check

import { helpers } from "@mashora/o-spreadsheet";

const { getFunctionsFromTokens } = helpers;

/** @typedef {import("@mashora/o-spreadsheet").Token} Token */

/**
 * Parse a spreadsheet formula and detect the number of LIST functions that are
 * present in the given formula.
 *
 * @param {Token[]} tokens
 *
 * @returns {number}
 */
export function getNumberOfListFormulas(tokens) {
    return getFunctionsFromTokens(tokens, ["MASHORA.LIST", "MASHORA.LIST.HEADER"]).length;
}

/**
 * Get the first List function description of the given formula.
 *
 * @param {Token[]} tokens
 *
 * @returns {import("../helpers/mashora_functions_helpers").MashoraFunctionDescription|undefined}
 */
export function getFirstListFunction(tokens) {
    return getFunctionsFromTokens(tokens, ["MASHORA.LIST", "MASHORA.LIST.HEADER"])[0];
}
