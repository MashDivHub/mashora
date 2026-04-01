# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import fields, models, _


class SurveyUser_Input(models.Model):
    _inherit = "survey.user_input"

    applicant_id = fields.Many2one('hr.applicant', string='Applicant', index='btree_not_null')

    def _mark_done(self):
        mashorabot = self.env.ref('base.partner_root')
        for user_input in self:
            if user_input.applicant_id:
                body = _('The applicant "%s" has finished the survey.', user_input.applicant_id.partner_name)
                user_input.applicant_id.message_post(body=body, author_id=mashorabot.id)
        return super()._mark_done()
