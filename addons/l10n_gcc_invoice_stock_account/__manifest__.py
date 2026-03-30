# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.
{
    'name': "Gulf Cooperation Council WMS Accounting",
    'version': '1.0',
    'description': """
Adds Arabic as a secondary language for the lots and serial numbers
    """,
    'category': 'Accounting/Localizations',

    'depends': ['l10n_gcc_invoice', 'stock_account'],

    'data': [
        'views/report_invoice.xml',
    ],
    'auto_install': True,
    'author': 'Mashora',
    'license': 'LGPL-3',
}
