"""HR models."""

from .hr_employee import HrEmployee, HrDepartment, HrJob
from .hr_leave import HrLeave, HrLeaveType, HrLeaveAllocation
from .hr_attendance import HrAttendance
from .hr_expense import HrExpense, HrExpenseSheet
from .hr_skill import HrSkill, HrSkillType, HrSkillLevel, HrEmployeeSkill
from .hr_contract import HrContract
from .hr_payslip import HrPayslip, HrPayslipBatch
from .hr_recruitment import HrRecruitmentStage, HrApplicant

__all__ = [
    "HrEmployee",
    "HrDepartment",
    "HrJob",
    "HrLeave",
    "HrLeaveType",
    "HrLeaveAllocation",
    "HrAttendance",
    "HrExpense",
    "HrExpenseSheet",
    "HrSkill",
    "HrSkillType",
    "HrSkillLevel",
    "HrEmployeeSkill",
    "HrContract",
    "HrPayslip",
    "HrPayslipBatch",
    "HrRecruitmentStage",
    "HrApplicant",
]
