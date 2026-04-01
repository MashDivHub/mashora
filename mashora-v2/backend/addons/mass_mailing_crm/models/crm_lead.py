# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import models


class CrmLead(models.Model):
    _inherit = 'crm.lead'
    _mailing_enabled = True
