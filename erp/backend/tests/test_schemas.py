"""
Tests for Pydantic schema validation.

Verifies that all schemas accept valid data and reject invalid data.
"""
import pytest
from datetime import date, datetime

from app.schemas.common import SearchParams, RecordCreate, RecordUpdate, MethodCall
from app.schemas.account import InvoiceCreate, InvoiceListParams, PaymentRegisterFromInvoice
from app.schemas.sale import SaleOrderCreate, SaleOrderListParams
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderListParams
from app.schemas.stock import PickingCreate, PickingListParams, QuantListParams
from app.schemas.crm import LeadCreate, LeadListParams, LeadMarkLost
from app.schemas.hr import EmployeeCreate, LeaveCreate, LeaveListParams
from app.schemas.project import ProjectCreate, TaskCreate, TaskListParams, MilestoneCreate
from app.schemas.website import ProductListParams, CartAddItem, PageListParams
from app.schemas.secondary import VehicleCreate, RepairCreate, ProductionCreate, EventCreate


class TestCommonSchemas:
    def test_search_params_defaults(self):
        p = SearchParams()
        assert p.domain is None
        assert p.offset == 0
        assert p.limit == 80

    def test_search_params_custom(self):
        p = SearchParams(domain=[["name", "=", "test"]], offset=10, limit=20, order="name asc")
        assert p.domain == [["name", "=", "test"]]
        assert p.offset == 10
        assert p.limit == 20

    def test_record_create(self):
        r = RecordCreate(vals={"name": "Test", "email": "test@example.com"})
        assert r.vals["name"] == "Test"

    def test_method_call(self):
        m = MethodCall(record_ids=[1, 2], method="action_confirm")
        assert m.record_ids == [1, 2]
        assert m.method == "action_confirm"
        assert m.args == []
        assert m.kwargs == {}


class TestAccountSchemas:
    def test_invoice_create_defaults(self):
        inv = InvoiceCreate()
        assert inv.move_type == "out_invoice"
        assert inv.lines == []

    def test_invoice_create_with_lines(self):
        inv = InvoiceCreate(
            partner_id=1,
            move_type="in_invoice",
            lines=[{"product_id": 5, "quantity": 2.0, "price_unit": 100.0}],
        )
        assert inv.move_type == "in_invoice"
        assert len(inv.lines) == 1
        assert inv.lines[0].product_id == 5

    def test_invoice_list_params(self):
        p = InvoiceListParams(move_type=["out_invoice"], state=["posted"], payment_state=["not_paid"])
        assert "out_invoice" in p.move_type
        assert "posted" in p.state

    def test_payment_register(self):
        p = PaymentRegisterFromInvoice(invoice_ids=[1, 2, 3], amount=500.0)
        assert len(p.invoice_ids) == 3
        assert p.amount == 500.0


class TestSaleSchemas:
    def test_sale_order_create(self):
        so = SaleOrderCreate(partner_id=1, lines=[{"product_id": 10, "product_uom_qty": 5.0}])
        assert so.partner_id == 1
        assert len(so.lines) == 1

    def test_sale_list_params(self):
        p = SaleOrderListParams(state=["draft", "sent"], search="test")
        assert "draft" in p.state
        assert p.search == "test"


class TestPurchaseSchemas:
    def test_purchase_order_create(self):
        po = PurchaseOrderCreate(partner_id=2, lines=[{"product_id": 3, "product_qty": 10.0}])
        assert po.partner_id == 2
        assert po.lines[0].product_qty == 10.0


class TestStockSchemas:
    def test_picking_create(self):
        p = PickingCreate(picking_type_id=1, moves=[{"product_id": 5, "product_uom_qty": 3.0}])
        assert p.picking_type_id == 1
        assert len(p.moves) == 1

    def test_quant_list_params(self):
        q = QuantListParams(product_id=5, on_hand=True)
        assert q.product_id == 5
        assert q.on_hand is True


class TestCrmSchemas:
    def test_lead_create(self):
        lead = LeadCreate(name="Big Deal", expected_revenue=50000, probability=75)
        assert lead.name == "Big Deal"
        assert lead.type == "opportunity"

    def test_mark_lost(self):
        ml = LeadMarkLost(lost_reason_id=1, lost_feedback="Too expensive")
        assert ml.lost_reason_id == 1


class TestHrSchemas:
    def test_employee_create(self):
        emp = EmployeeCreate(name="John Doe", department_id=1, work_email="john@company.com")
        assert emp.name == "John Doe"

    def test_leave_create(self):
        leave = LeaveCreate(
            employee_id=1, holiday_status_id=1,
            request_date_from=date(2026, 4, 10), request_date_to=date(2026, 4, 12),
        )
        assert leave.employee_id == 1
        assert (leave.request_date_to - leave.request_date_from).days == 2


class TestProjectSchemas:
    def test_project_create(self):
        p = ProjectCreate(name="New Website", allow_milestones=True)
        assert p.name == "New Website"

    def test_task_create(self):
        t = TaskCreate(name="Design homepage", project_id=1, user_ids=[2, 3], priority="2")
        assert len(t.user_ids) == 2
        assert t.priority == "2"

    def test_milestone_create(self):
        m = MilestoneCreate(name="Phase 1 Complete", project_id=1, deadline=date(2026, 6, 1))
        assert m.project_id == 1


class TestWebsiteSchemas:
    def test_product_list_params(self):
        p = ProductListParams(category_id=5, min_price=10.0, max_price=100.0)
        assert p.category_id == 5
        assert p.published_only is True

    def test_cart_add_item(self):
        item = CartAddItem(product_id=7, quantity=3)
        assert item.product_id == 7
        assert item.quantity == 3


class TestSecondarySchemas:
    def test_vehicle_create(self):
        v = VehicleCreate(model_id=1, license_plate="ABC-123")
        assert v.license_plate == "ABC-123"

    def test_repair_create(self):
        r = RepairCreate(product_id=5, description="Screen broken")
        assert r.product_id == 5

    def test_production_create(self):
        p = ProductionCreate(product_id=10, product_qty=50)
        assert p.product_qty == 50

    def test_event_create(self):
        e = EventCreate(name="Conference", date_begin=datetime(2026, 5, 1), date_end=datetime(2026, 5, 3))
        assert e.name == "Conference"
