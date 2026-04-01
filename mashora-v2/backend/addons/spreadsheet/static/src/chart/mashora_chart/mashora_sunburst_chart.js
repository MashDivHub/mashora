import { registries, chartHelpers } from "@mashora/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";
import { MashoraChart } from "./mashora_chart";
import { onMashoraChartItemHover, onSunburstMashoraChartItemClick } from "./mashora_chart_helpers";

const { chartRegistry } = registries;

const {
    getSunburstChartDatasets,
    CHART_COMMON_OPTIONS,
    getChartLayout,
    getChartTitle,
    getSunburstShowValues,
    getSunburstChartLegend,
    getSunburstChartTooltip,
} = chartHelpers;

export class MashoraSunburstChart extends MashoraChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.showLabels = definition.showLabels;
        this.valuesDesign = definition.valuesDesign;
        this.groupColors = definition.groupColors;
        this.pieHolePercentage = definition.pieHolePercentage;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            pieHolePercentage: this.pieHolePercentage,
            showLabels: this.showLabels,
            valuesDesign: this.valuesDesign,
            groupColors: this.groupColors,
        };
    }
}

chartRegistry.add("mashora_sunburst", {
    match: (type) => type === "mashora_sunburst",
    createChart: (definition, sheetId, getters) =>
        new MashoraSunburstChart(definition, sheetId, getters),
    getChartRuntime: createMashoraChartRuntime,
    validateChartDefinition: (validator, definition) =>
        MashoraSunburstChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => MashoraSunburstChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () =>
        MashoraSunburstChart.getDefinitionFromContextCreation(),
    name: _t("Sunburst"),
});

function createMashoraChartRuntime(chart, getters) {
    const background = chart.background || "#FFFFFF";
    const { datasets, labels } = chart.dataSource.getHierarchicalData();

    const definition = chart.getDefinition();
    const locale = getters.getLocale();

    const chartData = {
        labels,
        dataSetsValues: datasets.map((ds) => ({ data: ds.data, label: ds.label })),
        locale,
    };

    const config = {
        type: "doughnut",
        data: {
            labels: chartData.labels,
            datasets: getSunburstChartDatasets(definition, chartData),
        },
        options: {
            ...CHART_COMMON_OPTIONS,
            cutout: chart.pieHolePercentage === undefined ? "25%" : `${chart.pieHolePercentage}%`,
            layout: getChartLayout(definition, chartData),
            plugins: {
                title: getChartTitle(definition, getters),
                legend: getSunburstChartLegend(definition, chartData),
                tooltip: getSunburstChartTooltip(definition, chartData),
                sunburstLabelsPlugin: getSunburstShowValues(definition, chartData),
                sunburstHoverPlugin: { enabled: true },
            },
            onHover: onMashoraChartItemHover(),
            onClick: onSunburstMashoraChartItemClick(getters, chart),
        },
    };

    return { background, chartJsConfig: config };
}
