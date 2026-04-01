# Part of Mashora. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models

from mashora.addons.payment import reset_payment_provider, setup_provider


def post_init_hook(env):
    setup_provider(env, 'paymob')


def uninstall_hook(env):
    reset_payment_provider(env, 'paymob')
