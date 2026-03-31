import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { Layout } from "@web/search/layout";
import { useService } from "@web/core/utils/hooks";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { Component, onMounted, useState } from "@mashora/owl";

const BUSINESS_MODULES = [
    {
        name: "crm",
        label: _t("CRM"),
        description: _t("Pipeline management, lead flow, and revenue visibility."),
        model: "crm.lead",
        icon: "fa-line-chart",
    },
    {
        name: "sale_management",
        label: _t("Sales"),
        description: _t("Quotations, orders, and commercial execution."),
        model: "sale.order",
        icon: "fa-shopping-bag",
    },
    {
        name: "contacts",
        label: _t("Contacts"),
        description: _t("Customer records, companies, and account context."),
        model: "res.partner",
        icon: "fa-address-book-o",
    },
    {
        name: "project",
        label: _t("Projects"),
        description: _t("Delivery workflows, tasks, and cross-team collaboration."),
        model: "project.task",
        icon: "fa-sitemap",
    },
];

function normalizeName(value = "") {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatMetricValue(value) {
    return value === null ? _t("N/A") : value;
}

function buildLoadingMetrics() {
    return [
        {
            label: _t("Active users"),
            value: "...",
            icon: "fa-users",
            tone: "blue",
        },
        {
            label: _t("Companies"),
            value: "...",
            icon: "fa-building-o",
            tone: "green",
        },
        {
            label: _t("Scheduled jobs"),
            value: "...",
            icon: "fa-clock-o",
            tone: "amber",
        },
        {
            label: _t("Installed modules"),
            value: "...",
            icon: "fa-cubes",
            tone: "slate",
        },
    ];
}

function buildLoadingModules() {
    return BUSINESS_MODULES.map((module) => ({
        ...module,
        installed: false,
        stateLabel: _t("Checking"),
        count: null,
    }));
}

async function safeSearchCount(orm, model, domain = []) {
    try {
        return await orm.searchCount(model, domain);
    } catch {
        return null;
    }
}

async function safeSearchRead(orm, model, domain, fields, kwargs = {}) {
    try {
        return await orm.searchRead(model, domain, fields, kwargs);
    } catch {
        return [];
    }
}

export class MashoraCommandCenter extends Component {
    static template = "mashora_modern_ui.CommandCenter";
    static components = { Layout };
    static props = { ...standardActionServiceProps };

    setup() {
        this.actionService = useService("action");
        this.menuService = useService("menu");
        this.orm = useService("orm");

        this.state = useState({
            apps: [],
            metrics: buildLoadingMetrics(),
            businessModules: buildLoadingModules(),
            fetchedAt: "",
            installedModulesCount: "...",
            menuCount: "...",
            isLoading: true,
            loadError: "",
        });

        onMounted(() => {
            this.loadData();
        });
    }

    get display() {
        return {
            controlPanel: {},
        };
    }

    get greeting() {
        const hour = new Date().getHours();
        if (hour < 12) {
            return _t("Good morning");
        }
        if (hour < 18) {
            return _t("Good afternoon");
        }
        return _t("Good evening");
    }

    get statusLabel() {
        if (this.state.isLoading) {
            return _t("Refreshing data");
        }
        if (this.state.loadError) {
            return _t("Limited live data");
        }
        if (this.state.fetchedAt) {
            return `${_t("Updated")} ${this.state.fetchedAt}`;
        }
        return _t("Live view");
    }

    async loadData() {
        this.state.isLoading = true;
        this.state.loadError = "";

        try {
            const apps = this.menuService.getApps().map((app) => ({
                ...app,
                sectionCount: this.menuService.getMenuAsTree(app.id).childrenTree.length,
            }));
            const appNameSet = new Set(apps.map((app) => normalizeName(app.name)));

            const [
                usersCount,
                companiesCount,
                jobsCount,
                installedModulesCount,
                menuCount,
                moduleRows,
                modelRows,
            ] = await Promise.all([
                safeSearchCount(this.orm, "res.users", [["active", "=", true]]),
                safeSearchCount(this.orm, "res.company", []),
                safeSearchCount(this.orm, "ir.cron", []),
                safeSearchCount(this.orm, "ir.module.module", [["state", "=", "installed"]]),
                safeSearchCount(this.orm, "ir.ui.menu", []),
                safeSearchRead(
                    this.orm,
                    "ir.module.module",
                    [["name", "in", BUSINESS_MODULES.map((module) => module.name)]],
                    ["name", "state", "shortdesc"],
                    { limit: BUSINESS_MODULES.length }
                ),
                safeSearchRead(
                    this.orm,
                    "ir.model",
                    [["model", "in", BUSINESS_MODULES.map((module) => module.model)]],
                    ["model"],
                    { limit: BUSINESS_MODULES.length }
                ),
            ]);

            const availableModels = new Set(modelRows.map((row) => row.model));
            const moduleMap = new Map(moduleRows.map((row) => [row.name, row]));

            const recordCounts = await Promise.all(
                BUSINESS_MODULES.map((module) =>
                    availableModels.has(module.model)
                        ? safeSearchCount(this.orm, module.model, [])
                        : Promise.resolve(null)
                )
            );

            this.state.apps = apps;
            this.state.metrics = [
                {
                    label: _t("Active users"),
                    value: formatMetricValue(usersCount),
                    icon: "fa-users",
                    tone: "blue",
                },
                {
                    label: _t("Companies"),
                    value: formatMetricValue(companiesCount),
                    icon: "fa-building-o",
                    tone: "green",
                },
                {
                    label: _t("Scheduled jobs"),
                    value: formatMetricValue(jobsCount),
                    icon: "fa-clock-o",
                    tone: "amber",
                },
                {
                    label: _t("Installed modules"),
                    value: formatMetricValue(installedModulesCount),
                    icon: "fa-cubes",
                    tone: "slate",
                },
            ];
            this.state.businessModules = BUSINESS_MODULES.map((module, index) => {
                const moduleRow = moduleMap.get(module.name);
                const installed =
                    moduleRow?.state === "installed" ||
                    availableModels.has(module.model) ||
                    appNameSet.has(normalizeName(module.label));
                return {
                    ...module,
                    installed,
                    stateLabel: installed ? _t("Live") : _t("Ready to install"),
                    count: recordCounts[index],
                };
            });
            this.state.fetchedAt = new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            }).format(new Date());
            this.state.installedModulesCount = formatMetricValue(installedModulesCount);
            this.state.menuCount = formatMetricValue(menuCount);

            if ([usersCount, companiesCount, jobsCount, installedModulesCount, menuCount].some((value) => value === null)) {
                this.state.loadError = _t("Some live metrics are hidden by access rights.");
            }
        } catch {
            this.state.loadError = _t("We could not load live metrics right now.");
            this.state.metrics = buildLoadingMetrics();
            this.state.businessModules = buildLoadingModules();
            this.state.installedModulesCount = _t("N/A");
            this.state.menuCount = _t("N/A");
        } finally {
            this.state.isLoading = false;
        }
    }

    _getMenuByXmlId(xmlid) {
        return this.menuService.getAll().find((menu) => menu.xmlid === xmlid);
    }

    async openMenuByXmlId(xmlid) {
        const menu = this._getMenuByXmlId(xmlid);
        if (menu) {
            await this.menuService.selectMenu(menu);
        }
    }

    openUsers() {
        return this.openMenuByXmlId("base.menu_action_res_users");
    }

    openCompanies() {
        return this.openMenuByXmlId("base.menu_action_res_company_form");
    }

    openSettings() {
        return this.openMenuByXmlId("base_setup.menu_config");
    }

    openAppsCatalog() {
        return this.openMenuByXmlId("base.menu_management");
    }

    launchApp(app) {
        return this.menuService.selectMenu(app);
    }
}

registry.category("actions").add("mashora_modern_ui.command_center", MashoraCommandCenter);
