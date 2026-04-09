"""
Tests for the Mashora domain filter parser.

All tests are pure unit tests — no database connection required.
SQLAlchemy clauses are compiled to SQL strings for assertion.
"""
import pytest
from datetime import date, datetime

from sqlalchemy import Date as SADate, DateTime as SADateTime, String as SAString
from sqlalchemy import create_engine
from sqlalchemy.dialects import sqlite

from app.core.domain_parser import parse_domain, _coerce_value
from tests.conftest import FakeModel


def _sql(clause) -> str:
    """Compile a SQLAlchemy clause to a literal SQL string for assertion."""
    return str(clause.compile(dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}))


# ---------------------------------------------------------------------------
# Helpers to get column references for _coerce_value tests
# ---------------------------------------------------------------------------

_date_col = FakeModel.date_start
_datetime_col = FakeModel.create_date
_string_col = FakeModel.name


# ---------------------------------------------------------------------------
# parse_domain tests
# ---------------------------------------------------------------------------

class TestEmptyDomain:
    def test_empty_domain(self):
        clause = parse_domain(FakeModel, [])
        sql = _sql(clause)
        # Empty AND produces a true-ish clause (no conditions restricts nothing)
        assert sql is not None  # just verify it doesn't raise


class TestSimpleOperators:
    def test_simple_equals(self):
        clause = parse_domain(FakeModel, [["state", "=", "draft"]])
        sql = _sql(clause)
        assert "state" in sql
        assert "draft" in sql

    def test_not_equals(self):
        clause = parse_domain(FakeModel, [["active", "!=", True]])
        sql = _sql(clause)
        assert "active" in sql

    def test_greater_than(self):
        clause = parse_domain(FakeModel, [["amount", ">", 100]])
        sql = _sql(clause)
        assert "amount" in sql
        assert "100" in sql

    def test_less_than(self):
        clause = parse_domain(FakeModel, [["amount", "<", 50]])
        sql = _sql(clause)
        assert "amount" in sql
        assert "50" in sql

    def test_greater_than_or_equal(self):
        clause = parse_domain(FakeModel, [["amount", ">=", 10]])
        sql = _sql(clause)
        assert ">=" in sql

    def test_less_than_or_equal(self):
        clause = parse_domain(FakeModel, [["amount", "<=", 99]])
        sql = _sql(clause)
        assert "<=" in sql


class TestCollectionOperators:
    def test_in_operator(self):
        clause = parse_domain(FakeModel, [["state", "in", ["draft", "confirmed"]]])
        sql = _sql(clause)
        assert "state" in sql
        assert "draft" in sql
        assert "confirmed" in sql

    def test_not_in_operator(self):
        clause = parse_domain(FakeModel, [["state", "not in", ["cancel"]]])
        sql = _sql(clause)
        assert "state" in sql
        assert "cancel" in sql

    def test_in_empty_list(self):
        # Empty IN → always-false clause (NULL IS NULL AND NULL IS NOT NULL)
        clause = parse_domain(FakeModel, [["state", "in", []]])
        sql = _sql(clause)
        assert sql is not None  # should not crash


class TestStringOperators:
    def test_ilike_operator(self):
        clause = parse_domain(FakeModel, [["name", "ilike", "test"]])
        sql = _sql(clause)
        assert "name" in sql
        assert "test" in sql

    def test_ilike_with_wildcards(self):
        clause = parse_domain(FakeModel, [["name", "ilike", "%test%"]])
        sql = _sql(clause)
        assert "test" in sql

    def test_like_operator(self):
        clause = parse_domain(FakeModel, [["name", "like", "test%"]])
        sql = _sql(clause)
        assert "name" in sql
        assert "test" in sql


class TestBooleanOperators:
    def test_or_operator(self):
        clause = parse_domain(FakeModel, ["|", ["state", "=", "draft"], ["state", "=", "done"]])
        sql = _sql(clause)
        assert "state" in sql
        assert "OR" in sql.upper()

    def test_and_operator(self):
        clause = parse_domain(FakeModel, ["&", ["active", "=", True], ["amount", ">", 0]])
        sql = _sql(clause)
        assert "active" in sql
        assert "amount" in sql
        assert "AND" in sql.upper()

    def test_not_operator(self):
        clause = parse_domain(FakeModel, ["!", ["active", "=", True]])
        sql = _sql(clause)
        assert "active" in sql
        # SQLAlchemy compiles NOT(col = 1) to either "NOT ..." or "col != 1"
        sql_upper = sql.upper()
        assert "NOT" in sql_upper or "!=" in sql or "<>" in sql

    def test_nested_or_and(self):
        # ["|", "&", ["a","=",1], ["b","=",2], ["c","=",3]]
        # means: (a=1 AND b=2) OR c=3
        clause = parse_domain(FakeModel, [
            "|",
            "&", ["amount", "=", 1], ["partner_id", "=", 2],
            ["partner_id", "=", 3]
        ])
        sql = _sql(clause)
        assert "OR" in sql.upper() or "AND" in sql.upper()


class TestNullHandling:
    def test_equals_false_is_null(self):
        clause = parse_domain(FakeModel, [["partner_id", "=", False]])
        sql = _sql(clause)
        assert "IS NULL" in sql.upper() or "null" in sql.lower()

    def test_not_equals_false_is_not_null(self):
        clause = parse_domain(FakeModel, [["partner_id", "!=", False]])
        sql = _sql(clause)
        assert "IS NOT NULL" in sql.upper() or "not null" in sql.lower() or "IS NOT" in sql.upper()


class TestUnknownField:
    def test_unknown_field_ignored(self):
        # Should not raise — unknown fields return an always-true and_()
        clause = parse_domain(FakeModel, [["nonexistent_field", "=", "value"]])
        sql = _sql(clause)
        assert sql is not None

    def test_unknown_field_with_other_conditions(self):
        clause = parse_domain(FakeModel, [
            ["nonexistent_field", "=", "value"],
            ["state", "=", "draft"]
        ])
        sql = _sql(clause)
        assert "state" in sql


class TestMultipleConditions:
    def test_multiple_conditions_implicit_and(self):
        clause = parse_domain(FakeModel, [
            ["state", "=", "draft"],
            ["active", "=", True]
        ])
        sql = _sql(clause)
        assert "state" in sql
        assert "active" in sql


# ---------------------------------------------------------------------------
# _coerce_value tests
# ---------------------------------------------------------------------------

class TestCoerceValue:
    def test_coerce_date_string(self):
        result = _coerce_value(_date_col, "2024-01-15")
        assert isinstance(result, date)
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    def test_coerce_datetime_iso_t(self):
        """ISO format with T separator is parsed correctly."""
        result = _coerce_value(_datetime_col, "2024-01-15T10:30:00")
        assert isinstance(result, datetime)
        assert result.year == 2024
        assert result.hour == 10

    def test_coerce_datetime_date_only(self):
        """Date-only string for datetime column gets T00:00:00 appended."""
        result = _coerce_value(_datetime_col, "2024-01-15")
        assert isinstance(result, datetime)
        assert result.year == 2024
        assert result.hour == 0

    def test_coerce_non_date_string(self):
        result = _coerce_value(_string_col, "hello")
        assert result == "hello"

    def test_coerce_none_passthrough(self):
        result = _coerce_value(_string_col, None)
        assert result is None

    def test_coerce_false_passthrough(self):
        result = _coerce_value(_string_col, False)
        assert result is False

    def test_coerce_integer_passthrough(self):
        result = _coerce_value(_string_col, 42)
        assert result == 42

    def test_coerce_float_passthrough(self):
        result = _coerce_value(_string_col, 3.14)
        assert result == 3.14
