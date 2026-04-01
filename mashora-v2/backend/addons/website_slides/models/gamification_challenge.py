# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import models, fields


class GamificationChallenge(models.Model):
    _inherit = 'gamification.challenge'

    challenge_category = fields.Selection(selection_add=[
        ('slides', 'Website / Slides')
    ], ondelete={'slides': 'set default'})
