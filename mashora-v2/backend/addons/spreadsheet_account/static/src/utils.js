// @ts-check

import { helpers } from "@mashora/o-spreadsheet";

const { getFunctionsFromTokens } = helpers;

/**
 * @typedef {import("@mashora/o-spreadsheet").Token} Token
 * @typedef  {import("@spreadsheet/helpers/mashora_functions_helpers").MashoraFunctionDescription} MashoraFunctionDescription
 */

/**
 * @param {Token[]} tokens
 * @returns {number}
 */
export function getNumberOfAccountFormulas(tokens) {
    return getFunctionsFromTokens(tokens, ["MASHORA.BALANCE", "MASHORA.CREDIT", "MASHORA.DEBIT", "MASHORA.RESIDUAL", "MASHORA.PARTNER.BALANCE", "MASHORA.BALANCE.TAG"]).length;
}

/**
 * Get the first Account function description of the given formula.
 *
 * @param {Token[]} tokens
 * @returns {MashoraFunctionDescription | undefined}
 */
export function getFirstAccountFunction(tokens) {
    return getFunctionsFromTokens(tokens, ["MASHORA.BALANCE", "MASHORA.CREDIT", "MASHORA.DEBIT", "MASHORA.RESIDUAL", "MASHORA.PARTNER.BALANCE", "MASHORA.BALANCE.TAG"])[0];
}
