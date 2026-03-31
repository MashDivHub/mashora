# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

{
    "name": "Mashora Modern UI",
    "summary": "Modern business shell, command center, and lighter first load",
    "version": "1.1.0",
    "category": "Hidden",
    "depends": ["web"],
    "data": [
        "views/web_templates.xml",
        "views/module_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            ("remove", "web/static/src/webclient/settings_form_view/**/*"),
            "mashora_modern_ui/static/src/scss/webclient.scss",
            "mashora_modern_ui/static/src/xml/webclient.xml",
            "mashora_modern_ui/static/src/xml/command_center.xml",
            "mashora_modern_ui/static/src/js/webclient_patch.js",
            "mashora_modern_ui/static/src/js/command_center_action.js",
        ],
        "web.assets_backend_lazy": [
            "web/static/src/webclient/settings_form_view/**/*",
        ],
        "web.assets_frontend": [
            "mashora_modern_ui/static/src/scss/login.scss",
        ],
    },
    "installable": True,
    "application": False,
    "license": "LGPL-3",
}
