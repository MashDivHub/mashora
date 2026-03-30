import { registries, chartHelpers } from "@mashora/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";
import { MashoraChart } from "./mashora_chart";
import { onMashoraChartItemHover, onMashoraChartItemClick } from "./mashora_chart_helpers";

const { chartRegistry } = registries;

const {
    getFunnelChartDatasets,
    CHART_COMMON_OPTIONS,
    getChartLayout,
    getChartTitle,
    getChartShowValues,
    getFunnelChartScales,
    getFunnelChartTooltip,
    makeDatasetsCumulative,
} = chartHelpers;

export class MashoraFunnelChart extends MashoraChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.cumulative = definition.cumulative;
        this.funnelColors = definition.funnelColors;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            cumulative: this.cumulative,
            funnelColors: this.funnelColors,
        };
    }
}

chartRegistry.add("mashora_funnel", {
    match: (type) => type === "mashora_funnel",
    createChart: (definition, sheetId, getters) =>
        new MashoraFunnelChart(definition, sheetId, getters),
    getChartRuntime: createMashoraChartRuntime,
    validateChartDefinition: (validator, definition) =>
        MashoraFunnelChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => MashoraFunnelChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () => MashoraFunnelChart.getDefinitionFromContextCreation(),
    name: _t("Funnel"),
});

function createMashoraChartRuntime(chart, getters) {
    const definition = chart.getDefinition();
    const background = chart.background || "#FFFFFF";
    let { datasets, labels } = chart.dataSource.getData();
    if (definition.cumulative) {
        datasets = makeDatasetsCumulative(datasets, "desc");
    }

    const locale = getters.getLocale();

    const chartData = {
        labels,
        dataSetsValues: datasets.map((ds) => ({ data: ds.data, label: ds.label })),
        locale,
    };

    const config = {
        type: "funnel",
        data: {
            labels: chartData.labels,
            datasets: getFunnelChartDatasets(definition, chartData),
        },
        options: {
            ...CHART_COMMON_OPTIONS,
            indexAxis: "y",
            layout: getChartLayout(definition, chartData),
            scales: getFunnelChartScales(definition, chartData),
            plugins: {
                title: getChartTitle(definition, getters),
                legend: { display: false },
                tooltip: getFunnelChartTooltip(definition, chartData),
                chartShowValuesPlugin: getChartShowValues(definition, chartData),
            },
            onHover: onMashoraChartItemHover(),
            onClick: onMashoraChartItemClick(getters, chart),
        },
    };

    return { background, chartJsConfig: config };
}
