# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import models, fields


class MailActivityType(models.Model):
    _inherit = "mail.activity.type"

    category = fields.Selection(selection_add=[('meeting', 'Meeting')])
