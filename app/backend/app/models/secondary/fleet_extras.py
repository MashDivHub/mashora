"""Fleet extra models: contracts, odometer logs, assignations, services."""
from datetime import date, datetime
from typing import Optional
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin, CompanyMixin


class FleetVehicleLogContract(Base, TimestampMixin, CompanyMixin):
    __tablename__ = "fleet_vehicle_log_contract"
    __mashora_model__ = "fleet.vehicle.log.contract"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    vehicle_id: Mapped[int] = mapped_column(Integer, ForeignKey("fleet_vehicle.id"), nullable=False)
    insurer_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=True)
    purchaser_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiration_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    days_left: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    state: Mapped[str] = mapped_column(String, default="open", server_default="'open'")  # futur/open/expired/closed
    cost_amount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    cost_frequency: Mapped[str] = mapped_column(String, default="no", server_default="'no'")  # no/daily/weekly/monthly/yearly
    cost_subtype_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    insurance_company: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class FleetVehicleOdometer(Base, TimestampMixin):
    __tablename__ = "fleet_vehicle_odometer"
    __mashora_model__ = "fleet.vehicle.odometer"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    vehicle_id: Mapped[int] = mapped_column(Integer, ForeignKey("fleet_vehicle.id"), nullable=False)
    driver_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(String, default="kilometers", server_default="'kilometers'")  # kilometers/miles


class FleetVehicleAssignationLog(Base, TimestampMixin, CompanyMixin):
    __tablename__ = "fleet_vehicle_assignation_log"
    __mashora_model__ = "fleet.vehicle.assignation.log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(Integer, ForeignKey("fleet_vehicle.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
