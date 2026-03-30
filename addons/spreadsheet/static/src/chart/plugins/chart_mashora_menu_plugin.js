import { MashoraCorePlugin } from "@spreadsheet/plugins";
import { coreTypes, constants } from "@mashora/o-spreadsheet";
const { FIGURE_ID_SPLITTER } = constants;

/** Plugin that link charts with Mashora menus. It can contain either the Id of the mashora menu, or its xml id. */
export class ChartMashoraMenuPlugin extends MashoraCorePlugin {
    static getters = /** @type {const} */ (["getChartMashoraMenu"]);
    constructor(config) {
        super(config);
        this.mashoraMenuReference = {};
    }

    /**
     * Handle a spreadsheet command
     * @param {Object} cmd Command
     */
    handle(cmd) {
        switch (cmd.type) {
            case "LINK_MASHORA_MENU_TO_CHART":
                this.history.update("mashoraMenuReference", cmd.chartId, cmd.mashoraMenuId);
                break;
            case "DELETE_CHART":
                this.history.update("mashoraMenuReference", cmd.chartId, undefined);
                break;
            case "DUPLICATE_SHEET":
                this.updateOnDuplicateSheet(cmd.sheetId, cmd.sheetIdTo);
                break;
        }
    }

    updateOnDuplicateSheet(sheetIdFrom, sheetIdTo) {
        for (const oldChartId of this.getters.getChartIds(sheetIdFrom)) {
            const menu = this.mashoraMenuReference[oldChartId];
            if (!menu) {
                continue;
            }
            const chartIdBase = oldChartId.split(FIGURE_ID_SPLITTER).pop();
            const newChartId = `${sheetIdTo}${FIGURE_ID_SPLITTER}${chartIdBase}`;
            this.history.update("mashoraMenuReference", newChartId, menu);
        }
    }

    /**
     * Get mashora menu linked to the chart
     *
     * @param {string} chartId
     * @returns {object | undefined}
     */
    getChartMashoraMenu(chartId) {
        const menuId = this.mashoraMenuReference[chartId];
        return menuId ? this.getters.getIrMenu(menuId) : undefined;
    }

    import(data) {
        if (data.chartMashoraMenusReferences) {
            this.mashoraMenuReference = data.chartMashoraMenusReferences;
        }
    }

    export(data) {
        data.chartMashoraMenusReferences = this.mashoraMenuReference;
    }
}

coreTypes.add("LINK_MASHORA_MENU_TO_CHART");
