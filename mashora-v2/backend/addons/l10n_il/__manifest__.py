# Part of Mashora. See LICENSE file for full copyright and licensing details.
{
    'name': 'Israel - Accounting',
    'icon': '/account/static/description/l10n.png',
    'countries': ['il'],
    'version': '1.1',
    'category': 'Accounting/Localizations/Account Charts',
    'description': """
This is the latest basic Israelian localisation necessary to run Mashora in Israel:
================================================================================

This module consists of:
 - Generic Israel Chart of Accounts
 - Taxes and tax report
 - Multiple Fiscal positions
 """,
    'website': 'https://www.mashora.com/documentation/latest/applications/finance/fiscal_localizations.html',
    'depends': [
        'account',
    ],
    'auto_install': ['account'],
    'data': [
        'data/account_account_tag.xml',
        'data/account_tax_report_data.xml',
    ],
    'demo': [
        'demo/demo_company.xml',
    ],
    'author': 'Mashora',
    'license': 'LGPL-3',
}
