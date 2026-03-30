# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import fields, models


class ResourceTest(models.Model):
    _name = 'resource.test'
    _description = 'Test Resource Model'
    _inherit = ['resource.mixin']

    name = fields.Char()
