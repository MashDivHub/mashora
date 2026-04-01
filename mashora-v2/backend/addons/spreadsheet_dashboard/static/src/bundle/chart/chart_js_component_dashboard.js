import { components } from "@mashora/o-spreadsheet";
import { patch } from "@web/core/utils/patch";

patch(components.ChartJsComponent.prototype, {
    createChart(chartData) {
        if (this.env.model.getters.isDashboard()) {
            chartData = this.addMashoraMenuPluginToChartData(chartData);
        }
        super.createChart(chartData);
    },
    updateChartJs(chartData) {
        if (this.env.model.getters.isDashboard()) {
            chartData = this.addMashoraMenuPluginToChartData(chartData);
        }
        super.updateChartJs(chartData);
    },
    addMashoraMenuPluginToChartData(chartData) {
        chartData.chartJsConfig.options.plugins.chartMashoraMenuPlugin = {
            env: this.env,
            menu: this.env.model.getters.getChartMashoraMenu(this.props.chartId),
        };
        return chartData;
    },
});
