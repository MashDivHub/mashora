"""
Base models for Mashora ERP — res_ and ir_ tables.
"""
from .res_partner import ResPartner, ResPartnerCategory
from .res_users import ResUsers
from .res_company import ResCompany
from .res_currency import ResCurrency, ResCurrencyRate
from .res_country import ResCountry, ResCountryState
from .res_bank import ResBank, ResPartnerBank
from .res_groups import ResGroups
from .ir_sequence import IrSequence, IrSequenceDateRange
from .ir_attachment import IrAttachment
from .ir_config_parameter import IrConfigParameter
from .ir_model import IrModel, IrModelFields, IrModelAccess, IrModelData
from .ir_rule import IrRule
from .ir_ui_view import IrUiView
from .ir_ui_menu import IrUiMenu
from .ir_actions import IrActions, IrActWindow, IrActServer
from .ir_cron import IrCron
from .ir_module import IrModuleModule
from .ir_filters import IrFilters

__all__ = [
    "ResPartner",
    "ResPartnerCategory",
    "ResUsers",
    "ResCompany",
    "ResCurrency",
    "ResCurrencyRate",
    "ResCountry",
    "ResCountryState",
    "ResBank",
    "ResPartnerBank",
    "ResGroups",
    "IrSequence",
    "IrSequenceDateRange",
    "IrAttachment",
    "IrConfigParameter",
    "IrModel",
    "IrModelFields",
    "IrModelAccess",
    "IrModelData",
    "IrRule",
    "IrUiView",
    "IrUiMenu",
    "IrActions",
    "IrActWindow",
    "IrActServer",
    "IrCron",
    "IrModuleModule",
    "IrFilters",
]
