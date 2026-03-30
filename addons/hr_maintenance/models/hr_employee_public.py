# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import fields, models


class HrEmployeePublic(models.Model):
    _inherit = 'hr.employee.public'

    equipment_count = fields.Integer(related='employee_id.equipment_count')
