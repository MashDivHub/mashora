import mashora.tests
from mashora.tools import mute_logger


@mashora.tests.common.tagged('post_install', '-at_install')
class TestWebsiteError(mashora.tests.HttpCase):

    @mute_logger('mashora.addons.http_routing.models.ir_http', 'mashora.http')
    def test_01_run_test(self):
        self.start_tour("/test_error_view", 'test_error_website')
