import { CorePlugin, Model, UID } from "@mashora/o-spreadsheet";
import { ChartMashoraMenuPlugin, MashoraChartCorePlugin, MashoraChartCoreViewPlugin } from "@spreadsheet/chart";
import { CurrencyPlugin } from "@spreadsheet/currency/plugins/currency";
import { AccountingPlugin } from "addons/spreadsheet_account/static/src/plugins/accounting_plugin";
import { GlobalFiltersCorePlugin, GlobalFiltersCoreViewPlugin } from "@spreadsheet/global_filters";
import { ListCorePlugin, ListCoreViewPlugin } from "@spreadsheet/list";
import { IrMenuPlugin } from "@spreadsheet/ir_ui_menu/ir_ui_menu_plugin";
import { PivotMashoraCorePlugin } from "@spreadsheet/pivot";
import { PivotCoreGlobalFilterPlugin } from "@spreadsheet/pivot/plugins/pivot_core_global_filter_plugin";

type Getters = Model["getters"];
type CoreGetters = CorePlugin["getters"];

/**
 * Union of all getter names of a plugin.
 *
 * e.g. With the following plugin
 * @example
 * class MyPlugin {
 *   static getters = [
 *     "getCell",
 *     "getCellValue",
 *   ] as const;
 *   getCell() { ... }
 *   getCellValue() { ... }
 * }
 * type Names = GetterNames<typeof MyPlugin>
 * // is equivalent to "getCell" | "getCellValue"
 */
type GetterNames<Plugin extends { getters: readonly string[] }> = Plugin["getters"][number];

/**
 * Extract getter methods from a plugin, based on its `getters` static array.
 * @example
 * class MyPlugin {
 *   static getters = [
 *     "getCell",
 *     "getCellValue",
 *   ] as const;
 *   getCell() { ... }
 *   getCellValue() { ... }
 * }
 * type MyPluginGetters = PluginGetters<typeof MyPlugin>;
 * // MyPluginGetters is equivalent to:
 * // {
 * //   getCell: () => ...,
 * //   getCellValue: () => ...,
 * // }
 */
type PluginGetters<Plugin extends { new (...args: unknown[]): any; getters: readonly string[] }> =
    Pick<InstanceType<Plugin>, GetterNames<Plugin>>;

declare module "@spreadsheet" {
    /**
     * Add getters from custom plugins defined in mashora
     */

    interface MashoraCoreGetters extends CoreGetters {}
    interface MashoraCoreGetters extends PluginGetters<typeof GlobalFiltersCorePlugin> {}
    interface MashoraCoreGetters extends PluginGetters<typeof ListCorePlugin> {}
    interface MashoraCoreGetters extends PluginGetters<typeof MashoraChartCorePlugin> {}
    interface MashoraCoreGetters extends PluginGetters<typeof ChartMashoraMenuPlugin> {}
    interface MashoraCoreGetters extends PluginGetters<typeof IrMenuPlugin> {}
    interface MashoraCoreGetters extends PluginGetters<typeof PivotMashoraCorePlugin> {}
    interface MashoraCoreGetters extends PluginGetters<typeof PivotCoreGlobalFilterPlugin> {}

    interface MashoraGetters extends Getters {}
    interface MashoraGetters extends MashoraCoreGetters {}
    interface MashoraGetters extends PluginGetters<typeof GlobalFiltersCoreViewPlugin> {}
    interface MashoraGetters extends PluginGetters<typeof ListCoreViewPlugin> {}
    interface MashoraGetters extends PluginGetters<typeof MashoraChartCoreViewPlugin> {}
    interface MashoraGetters extends PluginGetters<typeof CurrencyPlugin> {}
    interface MashoraGetters extends PluginGetters<typeof AccountingPlugin> {}
}
