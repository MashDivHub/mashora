import { registries, chartHelpers } from "@mashora/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";
import { MashoraChart } from "./mashora_chart";
import { onGeoMashoraChartItemHover, onGeoMashoraChartItemClick } from "./mashora_chart_helpers";

const { chartRegistry } = registries;

const {
    getGeoChartDatasets,
    CHART_COMMON_OPTIONS,
    getChartLayout,
    getChartTitle,
    getGeoChartScales,
    getGeoChartTooltip,
} = chartHelpers;

export class MashoraGeoChart extends MashoraChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.colorScale = definition.colorScale;
        this.missingValueColor = definition.missingValueColor;
        this.region = definition.region;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            colorScale: this.colorScale,
            missingValueColor: this.missingValueColor,
            region: this.region,
        };
    }
}

chartRegistry.add("mashora_geo", {
    match: (type) => type === "mashora_geo",
    createChart: (definition, sheetId, getters) => new MashoraGeoChart(definition, sheetId, getters),
    getChartRuntime: createMashoraChartRuntime,
    validateChartDefinition: (validator, definition) =>
        MashoraGeoChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => MashoraGeoChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () => MashoraGeoChart.getDefinitionFromContextCreation(),
    name: _t("Geo"),
});

function createMashoraChartRuntime(chart, getters) {
    const background = chart.background || "#FFFFFF";
    const { datasets, labels } = chart.dataSource.getData();

    const definition = chart.getDefinition();
    const locale = getters.getLocale();

    const chartData = {
        labels,
        dataSetsValues: datasets.map((ds) => ({ data: ds.data, label: ds.label })),
        locale,
        availableRegions: getters.getGeoChartAvailableRegions(),
        geoFeatureNameToId: getters.geoFeatureNameToId,
        getGeoJsonFeatures: getters.getGeoJsonFeatures,
    };

    const config = {
        type: "choropleth",
        data: {
            datasets: getGeoChartDatasets(definition, chartData),
        },
        options: {
            ...CHART_COMMON_OPTIONS,
            layout: getChartLayout(definition, chartData),
            scales: getGeoChartScales(definition, chartData),
            plugins: {
                title: getChartTitle(definition, getters),
                tooltip: getGeoChartTooltip(definition, chartData),
                legend: { display: false },
            },
            onHover: onGeoMashoraChartItemHover(),
            onClick: onGeoMashoraChartItemClick(getters, chart),
        },
    };

    return { background, chartJsConfig: config };
}
