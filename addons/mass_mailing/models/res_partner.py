# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import models


class ResPartner(models.Model):
    _inherit = 'res.partner'
    _mailing_enabled = True
