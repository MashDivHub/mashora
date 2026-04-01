import { registries, chartHelpers } from "@mashora/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";
import { MashoraChart } from "./mashora_chart";
import { onMashoraChartItemHover, onMashoraChartItemClick } from "./mashora_chart_helpers";

const { chartRegistry } = registries;

const {
    getComboChartDatasets,
    CHART_COMMON_OPTIONS,
    getChartLayout,
    getBarChartScales,
    getBarChartTooltip,
    getChartTitle,
    getComboChartLegend,
    getChartShowValues,
    getTrendDatasetForBarChart,
} = chartHelpers;

export class MashoraComboChart extends MashoraChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.axesDesign = definition.axesDesign;
        this.hideDataMarkers = definition.hideDataMarkers;
        this.zoomable = definition.zoomable;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            axesDesign: this.axesDesign,
            hideDataMarkers: this.hideDataMarkers,
            zoomable: this.zoomable,
        };
    }

    get dataSets() {
        const dataSets = super.dataSets;
        if (dataSets.every((ds) => !ds.type)) {
            return dataSets.map((ds, index) => ({
                ...ds,
                type: index === 0 ? "bar" : "line",
            }));
        }
        return dataSets;
    }
}

chartRegistry.add("mashora_combo", {
    match: (type) => type === "mashora_combo",
    createChart: (definition, sheetId, getters) => new MashoraComboChart(definition, sheetId, getters),
    getChartRuntime: createMashoraChartRuntime,
    validateChartDefinition: (validator, definition) =>
        MashoraComboChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => MashoraComboChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () => MashoraComboChart.getDefinitionFromContextCreation(),
    name: _t("Combo"),
});

function createMashoraChartRuntime(chart, getters) {
    const background = chart.background || "#FFFFFF";
    const { datasets, labels } = chart.dataSource.getData();
    const definition = chart.getDefinition();

    const trendDataSetsValues = datasets.map((dataset, index) => {
        const trend = definition.dataSets[index]?.trend;
        return !trend?.display || chart.horizontal
            ? undefined
            : getTrendDatasetForBarChart(trend, dataset.data);
    });

    const chartData = {
        labels,
        dataSetsValues: datasets.map((ds) => ({ data: ds.data, label: ds.label })),
        locale: getters.getLocale(),
        trendDataSetsValues,
    };

    const config = {
        type: "bar",
        data: {
            labels: chartData.labels,
            datasets: getComboChartDatasets(definition, chartData),
        },
        options: {
            ...CHART_COMMON_OPTIONS,
            layout: getChartLayout(definition, chartData),
            scales: getBarChartScales(definition, chartData),
            plugins: {
                title: getChartTitle(definition, getters),
                legend: getComboChartLegend(definition, chartData),
                tooltip: getBarChartTooltip(definition, chartData),
                chartShowValuesPlugin: getChartShowValues(definition, chartData),
            },
            onHover: onMashoraChartItemHover(),
            onClick: onMashoraChartItemClick(getters, chart),
        },
    };

    return { background, chartJsConfig: config };
}
