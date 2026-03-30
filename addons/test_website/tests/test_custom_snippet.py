# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

import mashora.tests
from mashora.tools import mute_logger


@mashora.tests.common.tagged('post_install', '-at_install')
class TestCustomSnippet(mashora.tests.HttpCase):

    @mute_logger('mashora.addons.http_routing.models.ir_http', 'mashora.http')
    def test_01_run_tour(self):
        self.start_tour(self.env['website'].get_client_action_url('/'), 'test_custom_snippet', login="admin")
