from mashora.addons.account_edi.tests.common import AccountTestInvoicingCommon
from mashora.addons.point_of_sale.tests.test_generic_localization import TestGenericLocalization
from mashora.tests import tagged


@tagged('post_install', '-at_install', 'post_install_l10n')
class TestGenericPE(TestGenericLocalization):
    @classmethod
    @AccountTestInvoicingCommon.setup_country('pe')
    def setUpClass(cls):
        super().setUpClass()
