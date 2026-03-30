import { registries, chartHelpers } from "@mashora/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";
import { MashoraChart } from "./mashora_chart";
import { onMashoraChartItemHover, onMashoraChartItemClick } from "./mashora_chart_helpers";

const { chartRegistry } = registries;

const {
    getPieChartDatasets,
    CHART_COMMON_OPTIONS,
    getChartLayout,
    getPieChartTooltip,
    getChartTitle,
    getPieChartLegend,
    getChartShowValues,
    getTopPaddingForDashboard,
} = chartHelpers;

export class MashoraPieChart extends MashoraChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.isDoughnut = definition.isDoughnut;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            isDoughnut: this.isDoughnut,
        };
    }
}

chartRegistry.add("mashora_pie", {
    match: (type) => type === "mashora_pie",
    createChart: (definition, sheetId, getters) => new MashoraPieChart(definition, sheetId, getters),
    getChartRuntime: createMashoraChartRuntime,
    validateChartDefinition: (validator, definition) =>
        MashoraPieChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => MashoraPieChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () => MashoraPieChart.getDefinitionFromContextCreation(),
    name: _t("Pie"),
});

function createMashoraChartRuntime(chart, getters) {
    const background = chart.background || "#FFFFFF";
    const { datasets, labels } = chart.dataSource.getData();
    const definition = chart.getDefinition();
    definition.dataSets = datasets.map(() => ({ trend: definition.trend }));

    const chartData = {
        labels,
        dataSetsValues: datasets.map((ds) => ({ data: ds.data, label: ds.label })),
        locale: getters.getLocale(),
        topPadding: getTopPaddingForDashboard(definition, getters),
    };

    const config = {
        type: definition.isDoughnut ? "doughnut" : "pie",
        data: {
            labels: chartData.labels,
            datasets: getPieChartDatasets(definition, chartData),
        },
        options: {
            ...CHART_COMMON_OPTIONS,
            layout: getChartLayout(definition, chartData),
            plugins: {
                title: getChartTitle(definition, getters),
                legend: getPieChartLegend(definition, chartData),
                tooltip: getPieChartTooltip(definition, chartData),
                chartShowValuesPlugin: getChartShowValues(definition, chartData),
            },
            onHover: onMashoraChartItemHover(),
            onClick: onMashoraChartItemClick(getters, chart),
        },
    };

    return { background, chartJsConfig: config };
}
