import { CorePlugin, CoreViewPlugin, UIPlugin } from "@mashora/o-spreadsheet";

/**
 * An o-spreadsheet core plugin with access to all custom Mashora plugins
 * @type {import("@spreadsheet").MashoraCorePluginConstructor}
 **/
export const MashoraCorePlugin = CorePlugin;

/**
 * An o-spreadsheet CoreView plugin with access to all custom Mashora plugins
 * @type {import("@spreadsheet").MashoraUIPluginConstructor}
 **/
export const MashoraCoreViewPlugin = CoreViewPlugin;

/**
 * An o-spreadsheet UI plugin with access to all custom Mashora plugins
 * @type {import("@spreadsheet").MashoraUIPluginConstructor}
 **/
export const MashoraUIPlugin = UIPlugin;
