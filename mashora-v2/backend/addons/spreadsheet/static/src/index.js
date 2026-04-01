/**
 * This file is meant to load the different subparts of the module
 * to guarantee their plugins are loaded in the right order
 *
 * dependency:
 *             other plugins
 *                   |
 *                  ...
 *                   |
 *                filters
 *                /\    \
 *               /  \    \
 *           pivot  list  Mashora chart
 */

/** TODO: Introduce a position parameter to the plugin registry in order to load them in a specific order */
import * as spreadsheet from "@mashora/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";

const { corePluginRegistry, coreViewsPluginRegistry, featurePluginRegistry } =
    spreadsheet.registries;

import {
    GlobalFiltersCorePlugin,
    GlobalFiltersUIPlugin,
    GlobalFiltersCoreViewPlugin,
} from "@spreadsheet/global_filters/index";
import {
    PivotMashoraCorePlugin,
    PivotCoreViewGlobalFilterPlugin,
    PivotUIGlobalFilterPlugin,
} from "@spreadsheet/pivot/index"; // list depends on filter for its getters
import { ListCorePlugin, ListCoreViewPlugin, ListUIPlugin } from "@spreadsheet/list/index"; // pivot depends on filter for its getters
import {
    ChartMashoraMenuPlugin,
    MashoraChartCorePlugin,
    MashoraChartCoreViewPlugin,
} from "@spreadsheet/chart/index"; // Mashorachart depends on filter for its getters
import { PivotCoreGlobalFilterPlugin } from "./pivot/plugins/pivot_core_global_filter_plugin";
import { PivotMashoraUIPlugin } from "./pivot/plugins/pivot_mashora_ui_plugin";
import { ListCoreGlobalFilterPlugin } from "./list/plugins/list_core_global_filter_plugin";
import { globalFieldMatchingRegistry } from "./global_filters/helpers";
import { MashoraChartFeaturePlugin } from "./chart/plugins/mashora_chart_feature_plugin";
import { LoggingUIPlugin } from "@spreadsheet/logging/logging_ui_plugin";

globalFieldMatchingRegistry.add("pivot", {
    getIds: (getters) =>
        getters
            .getPivotIds()
            .filter(
                (id) =>
                    getters.getPivotCoreDefinition(id).type === "MASHORA" &&
                    getters.getPivotFieldMatch(id)
            ),
    getDisplayName: (getters, pivotId) => getters.getPivotName(pivotId),
    getTag: (getters, pivotId) =>
        _t("Pivot #%(pivot_id)s", { pivot_id: getters.getPivotFormulaId(pivotId) }),
    getFieldMatching: (getters, pivotId, filterId) =>
        getters.getPivotFieldMatching(pivotId, filterId),
    getModel: (getters, pivotId) => {
        const pivot = getters.getPivotCoreDefinition(pivotId);
        return pivot.type === "MASHORA" && pivot.model;
    },
    waitForReady: (getters) =>
        getters
            .getPivotIds()
            .map((pivotId) => getters.getPivot(pivotId))
            .filter((pivot) => pivot.type === "MASHORA")
            .map((pivot) => pivot.loadMetadata()),
    getFields: (getters, pivotId) => getters.getPivot(pivotId).getFields(),
    getActionXmlId: (getters, pivotId) => getters.getPivotCoreDefinition(pivotId).actionXmlId,
});

globalFieldMatchingRegistry.add("list", {
    getIds: (getters) => getters.getListIds().filter((id) => getters.getListFieldMatch(id)),
    getDisplayName: (getters, listId) => getters.getListName(listId),
    getTag: (getters, listId) => _t(`List #%(list_id)s`, { list_id: listId }),
    getFieldMatching: (getters, listId, filterId) => getters.getListFieldMatching(listId, filterId),
    getModel: (getters, listId) => getters.getListDefinition(listId).model,
    waitForReady: (getters) =>
        getters.getListIds().map((listId) => getters.getListDataSource(listId).loadMetadata()),
    getFields: (getters, listId) => getters.getListDataSource(listId).getFields(),
    getActionXmlId: (getters, listId) => getters.getListDefinition(listId).actionXmlId,
});

globalFieldMatchingRegistry.add("chart", {
    getIds: (getters) => getters.getMashoraChartIds(),
    getDisplayName: (getters, chartId) => getters.getMashoraChartDisplayName(chartId),
    getFieldMatching: (getters, chartId, filterId) =>
        getters.getMashoraChartFieldMatching(chartId, filterId),
    getModel: (getters, chartId) =>
        getters.getChart(chartId).getDefinitionForDataSource().metaData.resModel,
    getTag: async (getters, chartId) => {
        const chartModel = await getters.getChartDataSource(chartId).getModelLabel();
        return _t("Chart - %(chart_model)s", { chart_model: chartModel });
    },
    waitForReady: (getters) =>
        getters
            .getMashoraChartIds()
            .map((chartId) => getters.getChartDataSource(chartId).loadMetadata()),
    getFields: (getters, chartId) => getters.getChartDataSource(chartId).getFields(),
    getActionXmlId: (getters, chartId) => getters.getChartDefinition(chartId).actionXmlId,
});

corePluginRegistry.add("MashoraGlobalFiltersCorePlugin", GlobalFiltersCorePlugin);
corePluginRegistry.add("PivotMashoraCorePlugin", PivotMashoraCorePlugin);
corePluginRegistry.add("MashoraPivotGlobalFiltersCorePlugin", PivotCoreGlobalFilterPlugin);
corePluginRegistry.add("MashoraListCorePlugin", ListCorePlugin);
corePluginRegistry.add("MashoraListCoreGlobalFilterPlugin", ListCoreGlobalFilterPlugin);
corePluginRegistry.add("mashoraChartCorePlugin", MashoraChartCorePlugin);
corePluginRegistry.add("chartMashoraMenuPlugin", ChartMashoraMenuPlugin);

coreViewsPluginRegistry.add("MashoraGlobalFiltersCoreViewPlugin", GlobalFiltersCoreViewPlugin);
coreViewsPluginRegistry.add(
    "MashoraPivotGlobalFiltersCoreViewPlugin",
    PivotCoreViewGlobalFilterPlugin
);
coreViewsPluginRegistry.add("MashoraListCoreViewPlugin", ListCoreViewPlugin);
coreViewsPluginRegistry.add("MashoraChartCoreViewPlugin", MashoraChartCoreViewPlugin);
coreViewsPluginRegistry.add("MashoraLoggingUIPlugin", LoggingUIPlugin);

featurePluginRegistry.add("MashoraPivotGlobalFilterUIPlugin", PivotUIGlobalFilterPlugin);
featurePluginRegistry.add("MashoraGlobalFiltersUIPlugin", GlobalFiltersUIPlugin);
featurePluginRegistry.add("mashoraPivotUIPlugin", PivotMashoraUIPlugin);
featurePluginRegistry.add("mashoraListUIPlugin", ListUIPlugin);
featurePluginRegistry.add("MashoraChartFeaturePlugin", MashoraChartFeaturePlugin);
