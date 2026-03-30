# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.

{
    'name': 'MashoraBot',
    'version': '1.2',
    'category': 'Productivity/Discuss',
    'summary': 'Add MashoraBot in discussions',
    'website': 'https://www.mashora.com/app/discuss',
    'depends': ['mail'],
    'auto_install': True,
    'installable': True,
    'data': [
        'views/res_users_views.xml',
        'data/mailbot_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'mail_bot/static/src/scss/mashorabot_style.scss',
        ],
    },
    'author': 'Mashora',
    'license': 'LGPL-3',
}
