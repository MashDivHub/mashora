"""
Tests for the Mashora model registry.

All tests are pure unit tests — no database connection required.
"""
import pytest

from app.core.model_registry import get_model_class, get_fields_info, list_models


class TestGetModelClass:
    def test_get_known_model_res_partner(self):
        cls = get_model_class("res.partner")
        assert cls is not None

    def test_get_known_model_res_users(self):
        cls = get_model_class("res.users")
        assert cls is not None

    def test_get_known_model_res_company(self):
        cls = get_model_class("res.company")
        assert cls is not None

    def test_get_unknown_model_returns_none(self):
        cls = get_model_class("nonexistent.model")
        assert cls is None

    def test_get_completely_bogus_model(self):
        cls = get_model_class("fake.does.not.exist.at.all")
        assert cls is None

    def test_model_has_id_attribute(self):
        cls = get_model_class("res.partner")
        assert cls is not None
        assert hasattr(cls, "id")

    def test_returned_value_is_class(self):
        cls = get_model_class("res.partner")
        assert isinstance(cls, type)

    def test_get_sale_order(self):
        cls = get_model_class("sale.order")
        assert cls is not None

    def test_get_account_move(self):
        cls = get_model_class("account.move")
        assert cls is not None


class TestMultipleModelsRegistered:
    EXPECTED_MODELS = [
        "res.partner",
        "res.users",
        "res.company",
        "sale.order",
        "account.move",
    ]

    def test_all_expected_models_exist(self):
        for name in self.EXPECTED_MODELS:
            cls = get_model_class(name)
            assert cls is not None, f"Expected model '{name}' not found in registry"

    def test_list_models_returns_list(self):
        models = list_models()
        assert isinstance(models, list)
        assert len(models) > 0

    def test_list_models_sorted(self):
        models = list_models()
        assert models == sorted(models)

    def test_list_models_contains_known(self):
        models = list_models()
        assert "res.partner" in models


class TestGetFieldsInfo:
    def test_get_fields_info_returns_dict(self):
        info = get_fields_info("res.partner")
        assert isinstance(info, dict)
        assert len(info) > 0

    def test_get_fields_info_unknown_model_returns_empty(self):
        info = get_fields_info("nonexistent.model")
        assert info == {}

    def test_fields_info_has_id(self):
        info = get_fields_info("res.partner")
        assert "id" in info

    def test_fields_info_entry_has_type(self):
        info = get_fields_info("res.partner")
        # Each field should have a 'type' key
        for field_name, field_meta in info.items():
            assert "type" in field_meta, f"Field '{field_name}' missing 'type'"

    def test_fields_info_entry_has_string(self):
        info = get_fields_info("res.partner")
        for field_name, field_meta in info.items():
            assert "string" in field_meta, f"Field '{field_name}' missing 'string'"

    def test_fields_info_with_attributes_filter(self):
        info = get_fields_info("res.partner", attributes=["type", "string"])
        for field_name, field_meta in info.items():
            # 'name' is always included, plus the filtered attrs
            keys = set(field_meta.keys())
            assert keys.issubset({"name", "type", "string"}), (
                f"Field '{field_name}' has unexpected keys: {keys}"
            )
