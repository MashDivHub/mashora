# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora.tools.rendering_tools import template_env_globals
from mashora.http import request

template_env_globals.update({
    'slug': lambda value: request.env['ir.http']._slug(value)  # noqa: PLW0108
})

from . import controllers
from . import models
from . import utils
from . import wizard
