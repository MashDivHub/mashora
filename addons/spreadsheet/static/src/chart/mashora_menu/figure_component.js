import { patch } from "@web/core/utils/patch";
import * as spreadsheet from "@mashora/o-spreadsheet";
import { useService } from "@web/core/utils/hooks";
import { navigateToMashoraMenu } from "../mashora_chart/mashora_chart_helpers";

patch(spreadsheet.components.FigureComponent.prototype, {
    setup() {
        super.setup();
        this.actionService = useService("action");
        this.notificationService = useService("notification");
    },
    get chartId() {
        if (this.props.figureUI.tag !== "chart" && this.props.figureUI.tag !== "carousel") {
            return undefined;
        }
        return this.env.model.getters.getChartIdFromFigureId(this.props.figureUI.id);
    },
    async navigateToMashoraMenu(newWindow) {
        const menu = this.env.model.getters.getChartMashoraMenu(this.chartId);
        await navigateToMashoraMenu(menu, this.actionService, this.notificationService, newWindow);
    },
    get hasMashoraMenu() {
        return this.chartId && this.env.model.getters.getChartMashoraMenu(this.chartId) !== undefined;
    },
});

patch(spreadsheet.components.ScorecardChart.prototype, {
    setup() {
        super.setup();
        this.actionService = useService("action");
        this.notificationService = useService("notification");
    },
    async navigateToMashoraMenu(newWindow) {
        const menu = this.env.model.getters.getChartMashoraMenu(this.props.chartId);
        await navigateToMashoraMenu(menu, this.actionService, this.notificationService, newWindow);
    },
    get hasMashoraMenu() {
        return this.env.model.getters.getChartMashoraMenu(this.props.chartId) !== undefined;
    },
    async onClick() {
        if (this.env.isDashboard() && this.hasMashoraMenu) {
            await this.navigateToMashoraMenu();
        }
    },
});

patch(spreadsheet.components.GaugeChartComponent.prototype, {
    setup() {
        super.setup();
        this.actionService = useService("action");
        this.notificationService = useService("notification");
    },
    async navigateToMashoraMenu(newWindow) {
        const menu = this.env.model.getters.getChartMashoraMenu(this.props.chartId);
        await navigateToMashoraMenu(menu, this.actionService, this.notificationService, newWindow);
    },
    get hasMashoraMenu() {
        return this.env.model.getters.getChartMashoraMenu(this.props.chartId) !== undefined;
    },
    async onClick() {
        if (this.env.isDashboard() && this.hasMashoraMenu) {
            await this.navigateToMashoraMenu();
        }
    },
});
