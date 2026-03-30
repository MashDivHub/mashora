# Part of Mashora. See LICENSE file for full copyright and licensing details.

from markupsafe import Markup

from mashora import models, fields, _


class ResUsers(models.Model):
    _inherit = 'res.users'

    mashorabot_state = fields.Selection(
        [
            ('not_initialized', 'Not initialized'),
            ('onboarding_emoji', 'Onboarding emoji'),
            ('onboarding_attachement', 'Onboarding attachment'),
            ('onboarding_command', 'Onboarding command'),
            ('onboarding_ping', 'Onboarding ping'),
            ('onboarding_canned', 'Onboarding canned'),
            ('idle', 'Idle'),
            ('disabled', 'Disabled'),
        ], string="MashoraBot Status", readonly=True, required=False)  # keep track of the state: correspond to the code of the last message sent
    mashorabot_failed = fields.Boolean(readonly=True)

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['mashorabot_state']

    def _on_webclient_bootstrap(self):
        super()._on_webclient_bootstrap()
        if self._is_internal() and self.mashorabot_state in [False, "not_initialized"]:
            self._init_mashorabot()

    def _init_mashorabot(self):
        self.ensure_one()
        mashorabot_id = self.env['ir.model.data']._xmlid_to_res_id("base.partner_root")
        channel = self.env['discuss.channel']._get_or_create_chat([mashorabot_id, self.partner_id.id])
        message = Markup("%s<br/>%s<br/><b>%s</b> <span class=\"o_mashorabot_command\">:)</span>") % (
            _("Hello,"),
            _("Mashora's chat helps employees collaborate efficiently. I'm here to help you discover its features."),
            _("Try to send me an emoji")
        )
        channel.sudo().message_post(
            author_id=mashorabot_id,
            body=message,
            message_type="comment",
            silent=True,
            subtype_xmlid="mail.mt_comment",
        )
        self.sudo().mashorabot_state = 'onboarding_emoji'
        return channel
