import * as spreadsheet from "@mashora/o-spreadsheet";
import { MashoraChartCorePlugin } from "./plugins/mashora_chart_core_plugin";
import { ChartMashoraMenuPlugin } from "./plugins/chart_mashora_menu_plugin";
import { MashoraChartCoreViewPlugin } from "./plugins/mashora_chart_core_view_plugin";
import { _t } from "@web/core/l10n/translation";
import { chartMashoraMenuPlugin } from "./mashora_menu/mashora_menu_chartjs_plugin";

const { chartComponentRegistry, chartSubtypeRegistry, chartJsExtensionRegistry } =
    spreadsheet.registries;
const { ChartJsComponent, ZoomableChartJsComponent } = spreadsheet.components;

chartComponentRegistry.add("mashora_bar", ZoomableChartJsComponent);
chartComponentRegistry.add("mashora_line", ZoomableChartJsComponent);
chartComponentRegistry.add("mashora_pie", ChartJsComponent);
chartComponentRegistry.add("mashora_radar", ChartJsComponent);
chartComponentRegistry.add("mashora_sunburst", ChartJsComponent);
chartComponentRegistry.add("mashora_treemap", ChartJsComponent);
chartComponentRegistry.add("mashora_waterfall", ZoomableChartJsComponent);
chartComponentRegistry.add("mashora_pyramid", ChartJsComponent);
chartComponentRegistry.add("mashora_scatter", ChartJsComponent);
chartComponentRegistry.add("mashora_combo", ZoomableChartJsComponent);
chartComponentRegistry.add("mashora_geo", ChartJsComponent);
chartComponentRegistry.add("mashora_funnel", ChartJsComponent);

chartSubtypeRegistry.add("mashora_line", {
    matcher: (definition) =>
        definition.type === "mashora_line" && !definition.stacked && !definition.fillArea,
    subtypeDefinition: { stacked: false, fillArea: false },
    displayName: _t("Line"),
    chartSubtype: "mashora_line",
    chartType: "mashora_line",
    category: "line",
    preview: "o-spreadsheet-ChartPreview.LINE_CHART",
});
chartSubtypeRegistry.add("mashora_stacked_line", {
    matcher: (definition) =>
        definition.type === "mashora_line" && definition.stacked && !definition.fillArea,
    subtypeDefinition: { stacked: true, fillArea: false },
    displayName: _t("Stacked Line"),
    chartSubtype: "mashora_stacked_line",
    chartType: "mashora_line",
    category: "line",
    preview: "o-spreadsheet-ChartPreview.STACKED_LINE_CHART",
});
chartSubtypeRegistry.add("mashora_area", {
    matcher: (definition) =>
        definition.type === "mashora_line" && !definition.stacked && definition.fillArea,
    subtypeDefinition: { stacked: false, fillArea: true },
    displayName: _t("Area"),
    chartSubtype: "mashora_area",
    chartType: "mashora_line",
    category: "area",
    preview: "o-spreadsheet-ChartPreview.AREA_CHART",
});
chartSubtypeRegistry.add("mashora_stacked_area", {
    matcher: (definition) =>
        definition.type === "mashora_line" && definition.stacked && definition.fillArea,
    subtypeDefinition: { stacked: true, fillArea: true },
    displayName: _t("Stacked Area"),
    chartSubtype: "mashora_stacked_area",
    chartType: "mashora_line",
    category: "area",
    preview: "o-spreadsheet-ChartPreview.STACKED_AREA_CHART",
});
chartSubtypeRegistry.add("mashora_bar", {
    matcher: (definition) =>
        definition.type === "mashora_bar" && !definition.stacked && !definition.horizontal,
    subtypeDefinition: { stacked: false, horizontal: false },
    displayName: _t("Column"),
    chartSubtype: "mashora_bar",
    chartType: "mashora_bar",
    category: "column",
    preview: "o-spreadsheet-ChartPreview.COLUMN_CHART",
});
chartSubtypeRegistry.add("mashora_stacked_bar", {
    matcher: (definition) =>
        definition.type === "mashora_bar" && definition.stacked && !definition.horizontal,
    subtypeDefinition: { stacked: true, horizontal: false },
    displayName: _t("Stacked Column"),
    chartSubtype: "mashora_stacked_bar",
    chartType: "mashora_bar",
    category: "column",
    preview: "o-spreadsheet-ChartPreview.STACKED_COLUMN_CHART",
});
chartSubtypeRegistry.add("mashora_horizontal_bar", {
    matcher: (definition) =>
        definition.type === "mashora_bar" && !definition.stacked && definition.horizontal,
    subtypeDefinition: { stacked: false, horizontal: true },
    displayName: _t("Bar"),
    chartSubtype: "mashora_horizontal_bar",
    chartType: "mashora_bar",
    category: "bar",
    preview: "o-spreadsheet-ChartPreview.BAR_CHART",
});
chartSubtypeRegistry.add("mashora_horizontal_stacked_bar", {
    matcher: (definition) =>
        definition.type === "mashora_bar" && definition.stacked && definition.horizontal,
    subtypeDefinition: { stacked: true, horizontal: true },
    displayName: _t("Stacked Bar"),
    chartSubtype: "mashora_horizontal_stacked_bar",
    chartType: "mashora_bar",
    category: "bar",
    preview: "o-spreadsheet-ChartPreview.STACKED_BAR_CHART",
});
chartSubtypeRegistry.add("mashora_combo", {
    displayName: _t("Combo"),
    chartSubtype: "mashora_combo",
    chartType: "mashora_combo",
    category: "line",
    preview: "o-spreadsheet-ChartPreview.COMBO_CHART",
});
chartSubtypeRegistry.add("mashora_pie", {
    displayName: _t("Pie"),
    matcher: (definition) => definition.type === "mashora_pie" && !definition.isDoughnut,
    subtypeDefinition: { isDoughnut: false },
    chartSubtype: "mashora_pie",
    chartType: "mashora_pie",
    category: "pie",
    preview: "o-spreadsheet-ChartPreview.PIE_CHART",
});
chartSubtypeRegistry.add("mashora_doughnut", {
    matcher: (definition) => definition.type === "mashora_pie" && definition.isDoughnut,
    subtypeDefinition: { isDoughnut: true },
    displayName: _t("Doughnut"),
    chartSubtype: "mashora_doughnut",
    chartType: "mashora_pie",
    category: "pie",
    preview: "o-spreadsheet-ChartPreview.DOUGHNUT_CHART",
});
chartSubtypeRegistry.add("mashora_scatter", {
    displayName: _t("Scatter"),
    chartType: "mashora_scatter",
    chartSubtype: "mashora_scatter",
    category: "misc",
    preview: "o-spreadsheet-ChartPreview.SCATTER_CHART",
});
chartSubtypeRegistry.add("mashora_waterfall", {
    displayName: _t("Waterfall"),
    chartSubtype: "mashora_waterfall",
    chartType: "mashora_waterfall",
    category: "misc",
    preview: "o-spreadsheet-ChartPreview.WATERFALL_CHART",
});
chartSubtypeRegistry.add("mashora_pyramid", {
    displayName: _t("Population Pyramid"),
    chartSubtype: "mashora_pyramid",
    chartType: "mashora_pyramid",
    category: "misc",
    preview: "o-spreadsheet-ChartPreview.POPULATION_PYRAMID_CHART",
});
chartSubtypeRegistry.add("mashora_radar", {
    matcher: (definition) => definition.type === "mashora_radar" && !definition.fillArea,
    displayName: _t("Radar"),
    chartSubtype: "mashora_radar",
    chartType: "mashora_radar",
    subtypeDefinition: { fillArea: false },
    category: "misc",
    preview: "o-spreadsheet-ChartPreview.RADAR_CHART",
});
chartSubtypeRegistry.add("mashora_filled_radar", {
    matcher: (definition) => definition.type === "mashora_radar" && !!definition.fillArea,
    displayName: _t("Filled Radar"),
    chartType: "mashora_radar",
    chartSubtype: "mashora_filled_radar",
    subtypeDefinition: { fillArea: true },
    category: "misc",
    preview: "o-spreadsheet-ChartPreview.FILLED_RADAR_CHART",
});
chartSubtypeRegistry.add("mashora_geo", {
    displayName: _t("Geo chart"),
    chartType: "mashora_geo",
    chartSubtype: "mashora_geo",
    category: "misc",
    preview: "o-spreadsheet-ChartPreview.GEO_CHART",
});
chartSubtypeRegistry.add("mashora_funnel", {
    matcher: (definition) => definition.type === "mashora_funnel",
    displayName: _t("Funnel"),
    chartType: "mashora_funnel",
    chartSubtype: "mashora_funnel",
    subtypeDefinition: { cumulative: true },
    category: "misc",
    preview: "o-spreadsheet-ChartPreview.FUNNEL_CHART",
});
chartSubtypeRegistry.add("mashora_treemap", {
    displayName: _t("Treemap"),
    chartType: "mashora_treemap",
    chartSubtype: "mashora_treemap",
    category: "hierarchical",
    preview: "o-spreadsheet-ChartPreview.TREE_MAP_CHART",
});
chartSubtypeRegistry.add("mashora_sunburst", {
    displayName: _t("Sunburst"),
    chartType: "mashora_sunburst",
    chartSubtype: "mashora_sunburst",
    category: "hierarchical",
    preview: "o-spreadsheet-ChartPreview.SUNBURST_CHART",
});

chartJsExtensionRegistry.add("chartMashoraMenuPlugin", {
    register: (Chart) => Chart.register(chartMashoraMenuPlugin),
    unregister: (Chart) => Chart.unregister(chartMashoraMenuPlugin),
});

export { MashoraChartCorePlugin, ChartMashoraMenuPlugin, MashoraChartCoreViewPlugin };
