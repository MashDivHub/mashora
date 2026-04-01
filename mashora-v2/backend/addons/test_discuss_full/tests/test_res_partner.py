# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora.addons.mail.tests.common import mail_new_test_user
from mashora.addons.mail.tests.common import MailCommon
from mashora.addons.mail.tools.discuss import Store


class TestResPartner(MailCommon):

    def test_portal_user_store_data_access(self):
        portal_user = mail_new_test_user(self.env, login="portal-user", groups="base.group_portal")
        Store().add(portal_user.partner_id.with_user(self.user_employee_c2))
