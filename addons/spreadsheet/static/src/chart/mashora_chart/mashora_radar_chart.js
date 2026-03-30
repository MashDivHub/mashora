import { registries, chartHelpers } from "@mashora/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";
import { MashoraChart } from "./mashora_chart";
import { onMashoraChartItemHover, onMashoraChartItemClick } from "./mashora_chart_helpers";

const { chartRegistry } = registries;

const {
    getRadarChartDatasets,
    CHART_COMMON_OPTIONS,
    getChartLayout,
    getChartTitle,
    getChartShowValues,
    getRadarChartScales,
    getRadarChartLegend,
    getRadarChartTooltip,
} = chartHelpers;

export class MashoraRadarChart extends MashoraChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.fillArea = definition.fillArea;
        this.hideDataMarkers = definition.hideDataMarkers;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            fillArea: this.fillArea,
            hideDataMarkers: this.hideDataMarkers,
        };
    }
}

chartRegistry.add("mashora_radar", {
    match: (type) => type === "mashora_radar",
    createChart: (definition, sheetId, getters) => new MashoraRadarChart(definition, sheetId, getters),
    getChartRuntime: createMashoraChartRuntime,
    validateChartDefinition: (validator, definition) =>
        MashoraRadarChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => MashoraRadarChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () => MashoraRadarChart.getDefinitionFromContextCreation(),
    name: _t("Radar"),
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
    };

    const config = {
        type: "radar",
        data: {
            labels: chartData.labels,
            datasets: getRadarChartDatasets(definition, chartData),
        },
        options: {
            ...CHART_COMMON_OPTIONS,
            layout: getChartLayout(definition, chartData),
            scales: getRadarChartScales(definition, chartData),
            plugins: {
                title: getChartTitle(definition, getters),
                legend: getRadarChartLegend(definition, chartData),
                tooltip: getRadarChartTooltip(definition, chartData),
                chartShowValuesPlugin: getChartShowValues(definition, chartData),
            },
            onHover: onMashoraChartItemHover(),
            onClick: onMashoraChartItemClick(getters, chart),
        },
    };

    return { background, chartJsConfig: config };
}
