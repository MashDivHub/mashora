"""
Tests for base service utilities.

All tests are pure unit tests — no database connection required.
_to_dict, _records_to_list, _apply_order, _first_of_month, _today are
pure functions that can be tested without a live DB.
"""
import pytest
from datetime import date, datetime

from app.services.base import (
    _to_dict,
    _records_to_list,
    _apply_order,
    _first_of_month,
    _today,
    RecordNotFoundError,
)
from tests.conftest import FakeModel


# ---------------------------------------------------------------------------
# RecordNotFoundError
# ---------------------------------------------------------------------------

class TestRecordNotFoundError:
    def test_message_includes_model(self):
        err = RecordNotFoundError("sale.order", 42)
        assert "sale.order" in str(err)

    def test_message_includes_id(self):
        err = RecordNotFoundError("res.partner", 99)
        assert "99" in str(err)

    def test_is_exception(self):
        err = RecordNotFoundError("account.move", 1)
        assert isinstance(err, Exception)

    def test_model_attr(self):
        err = RecordNotFoundError("sale.order", 7)
        assert err.model == "sale.order"

    def test_record_id_attr(self):
        err = RecordNotFoundError("sale.order", 7)
        assert err.record_id == 7


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

class TestDateHelpers:
    def test_first_of_month_is_string(self):
        result = _first_of_month()
        assert isinstance(result, str)

    def test_first_of_month_day_is_01(self):
        result = _first_of_month()
        assert result.endswith("-01")

    def test_first_of_month_parseable(self):
        result = _first_of_month()
        parsed = date.fromisoformat(result)
        assert parsed.day == 1

    def test_today_is_string(self):
        result = _today()
        assert isinstance(result, str)

    def test_today_parseable(self):
        result = _today()
        parsed = date.fromisoformat(result)
        assert parsed == date.today()


# ---------------------------------------------------------------------------
# _to_dict — uses FakeModel instances with proper SA instrumentation
# ---------------------------------------------------------------------------

def _make_fake_record(**kwargs):
    """Create a FakeModel instance with given attributes.
    Use the normal constructor so SA instrumentation is initialized."""
    defaults = {
        "id": 1,
        "name": "Test",
        "active": True,
        "amount": 0.0,
        "state": "draft",
        "partner_id": None,
        "date_start": None,
        "create_date": None,
    }
    defaults.update(kwargs)
    # Use normal constructor — SA handles _sa_instance_state
    record = FakeModel(**defaults)
    return record


class TestToDict:
    def test_simple_record_returns_dict(self):
        record = _make_fake_record(id=1, name="Alpha", state="draft")
        result = _to_dict(record)
        assert isinstance(result, dict)

    def test_id_always_included(self):
        record = _make_fake_record(id=5, name="Beta")
        result = _to_dict(record)
        assert result["id"] == 5

    def test_name_field_returned(self):
        record = _make_fake_record(id=1, name="Gamma")
        result = _to_dict(record)
        assert result["name"] == "Gamma"

    def test_state_field_returned(self):
        record = _make_fake_record(id=1, state="confirmed")
        result = _to_dict(record)
        assert result["state"] == "confirmed"

    def test_jsonb_dict_en_us_extracted(self):
        record = _make_fake_record(id=1, name={"en_US": "Hello", "fr_FR": "Bonjour"})
        result = _to_dict(record)
        assert result["name"] == "Hello"

    def test_jsonb_dict_fallback_to_first_value(self):
        record = _make_fake_record(id=1, name={"fr_FR": "Bonjour"})
        result = _to_dict(record)
        assert result["name"] == "Bonjour"

    def test_jsonb_empty_dict_becomes_empty_string(self):
        record = _make_fake_record(id=1, name={})
        result = _to_dict(record)
        assert result["name"] == ""

    def test_date_serialized_to_iso(self):
        d = date(2024, 3, 15)
        record = _make_fake_record(id=1, date_start=d)
        result = _to_dict(record)
        assert result["date_start"] == "2024-03-15"

    def test_datetime_serialized_to_iso(self):
        dt = datetime(2024, 3, 15, 10, 30, 0)
        record = _make_fake_record(id=1, create_date=dt)
        result = _to_dict(record)
        assert "2024-03-15" in result["create_date"]

    def test_fields_filter_excludes_other_fields(self):
        record = _make_fake_record(id=1, name="Test", state="draft", amount=99.0)
        result = _to_dict(record, fields=["name"])
        assert "name" in result
        assert "id" in result
        assert "state" not in result
        assert "amount" not in result

    def test_fields_filter_includes_id(self):
        record = _make_fake_record(id=7, name="Only name requested")
        result = _to_dict(record, fields=["name"])
        assert result["id"] == 7

    def test_none_fields_returns_all(self):
        record = _make_fake_record(id=1, name="All", state="done")
        result = _to_dict(record, fields=None)
        assert "name" in result
        assert "state" in result
        assert "amount" in result


# ---------------------------------------------------------------------------
# _records_to_list
# ---------------------------------------------------------------------------

class TestRecordsToList:
    def test_empty_list(self):
        result = _records_to_list([])
        assert result == []

    def test_single_record(self):
        record = _make_fake_record(id=1, name="One")
        result = _records_to_list([record])
        assert len(result) == 1
        assert result[0]["id"] == 1

    def test_multiple_records(self):
        records = [_make_fake_record(id=i, name=f"Record {i}") for i in range(1, 4)]
        result = _records_to_list(records)
        assert len(result) == 3
        assert result[0]["id"] == 1
        assert result[2]["id"] == 3

    def test_fields_filter_propagated(self):
        records = [_make_fake_record(id=1, name="Alpha", state="draft")]
        result = _records_to_list(records, fields=["name"])
        assert "name" in result[0]
        assert "state" not in result[0]


# ---------------------------------------------------------------------------
# _apply_order
# ---------------------------------------------------------------------------

class TestApplyOrder:
    def _base_query(self):
        from sqlalchemy import select
        return select(FakeModel)

    def test_no_order_defaults_to_id_desc(self):
        q = self._base_query()
        q2 = _apply_order(q, FakeModel, None)
        sql = str(q2.compile(compile_kwargs={"literal_binds": True}))
        assert "id" in sql.lower()
        assert "DESC" in sql.upper()

    def test_order_name_asc(self):
        q = self._base_query()
        q2 = _apply_order(q, FakeModel, "name asc")
        sql = str(q2.compile(compile_kwargs={"literal_binds": True}))
        assert "name" in sql.lower()
        assert "ASC" in sql.upper()

    def test_order_amount_desc(self):
        q = self._base_query()
        q2 = _apply_order(q, FakeModel, "amount DESC")
        sql = str(q2.compile(compile_kwargs={"literal_binds": True}))
        assert "amount" in sql.lower()
        assert "DESC" in sql.upper()

    def test_order_multi_column(self):
        q = self._base_query()
        q2 = _apply_order(q, FakeModel, "name asc, amount desc")
        sql = str(q2.compile(compile_kwargs={"literal_binds": True}))
        assert "name" in sql.lower()
        assert "amount" in sql.lower()

    def test_order_unknown_field_skipped(self):
        q = self._base_query()
        q2 = _apply_order(q, FakeModel, "nonexistent_col asc")
        assert q2 is not None

    def test_returns_query_object(self):
        from sqlalchemy.sql.selectable import Select
        q = self._base_query()
        q2 = _apply_order(q, FakeModel, "name asc")
        assert isinstance(q2, Select)
