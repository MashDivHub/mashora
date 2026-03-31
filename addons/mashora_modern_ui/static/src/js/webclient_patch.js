import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { NavBar } from "@web/webclient/navbar/navbar";
import { WebClient } from "@web/webclient/webclient";
import { onMounted, useState } from "@mashora/owl";

const THEME_STORAGE_KEY = "mashora-modern-ui-theme";

function getPreferredTheme() {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
        return storedTheme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode) {
    document.body.dataset.mshTheme = mode;
    document.documentElement.dataset.mshTheme = mode;
}

function getCommandCenterAction() {
    return {
        type: "ir.actions.client",
        tag: "mashora_modern_ui.command_center",
        name: _t("Command Center"),
        target: "current",
    };
}

patch(WebClient, {
    template: "mashora_modern_ui.WebClient",
});

patch(WebClient.prototype, {
    setup() {
        super.setup(...arguments);
        onMounted(() => {
            applyTheme(getPreferredTheme());
        });
    },
    async _loadDefaultApp() {
        try {
            return await this.actionService.doAction(getCommandCenterAction(), {
                clearBreadcrumbs: true,
            });
        } catch {
            return super._loadDefaultApp();
        }
    },
});

patch(NavBar, {
    template: "mashora_modern_ui.NavBar",
});

patch(NavBar.prototype, {
    setup() {
        super.setup(...arguments);
        this.themeState = useState({ mode: getPreferredTheme() });
        applyTheme(this.themeState.mode);
    },
    get currentTheme() {
        return this.themeState.mode;
    },
    toggleColorMode() {
        const nextTheme = this.themeState.mode === "dark" ? "light" : "dark";
        this.themeState.mode = nextTheme;
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
    },
    openCommandCenter() {
        return this.actionService.doAction(getCommandCenterAction(), {
            clearBreadcrumbs: true,
        });
    },
});
