"""SQLAlchemy models describing the payment processing domain."""

import enum
import uuid

from sqlalchemy import (
	Boolean,
	Column,
	DateTime,
	Enum,
	ForeignKey,
	Integer,
	Numeric,
	String,
	Text,
)
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db.database import Base


class PaymentStatus(str, enum.Enum):
	"""Enumeration of all supported payment states."""

	CREATED = "CREATED"
	PROCESSING = "PROCESSING"
	SUCCESS = "SUCCESS"
	FAILED = "FAILED"
	REFUNDED = "REFUNDED"


class Payment(Base):
	"""Persistent representation of a payment lifecycle."""

	__tablename__ = "payments"

	id = Column(
		String,
		primary_key=True,
		index=True,
		default=lambda: str(uuid.uuid4()),
	)
	payment_reference = Column(String(64), unique=True, index=True, nullable=False)
	amount = Column(Numeric(12, 2), nullable=False)
	currency = Column(String(3), nullable=False, default="USD")
	description = Column(Text, nullable=True)
	status = Column(
		Enum(PaymentStatus, native_enum=False, length=20),
		nullable=False,
		default=PaymentStatus.CREATED,
	)
	failure_reason = Column(Text, nullable=True)
	rule_triggered = Column(String(64), nullable=True)
	retry_count = Column(Integer, nullable=False, default=0)
	customer_email = Column(String(255), nullable=True)
	user_id = Column(
		String,
		ForeignKey("users.id", ondelete="SET NULL"),
		nullable=True,
		index=True,
	)
	processing_started_at = Column(DateTime(timezone=True), nullable=True)
	completed_at = Column(DateTime(timezone=True), nullable=True)
	created_at = Column(
		DateTime(timezone=True),
		server_default=func.now(),
		nullable=False,
	)
	updated_at = Column(
		DateTime(timezone=True),
		server_default=func.now(),
		onupdate=func.now(),
		nullable=False,
	)

	events = relationship(
		"PaymentEvent",
		back_populates="payment",
		cascade="all, delete-orphan",
		lazy="joined",
	)
	user = relationship("User", back_populates="payments", lazy="joined")


class PaymentEvent(Base):
	"""Audit log capturing every payment status change."""

	__tablename__ = "payment_events"

	id = Column(
		String,
		primary_key=True,
		default=lambda: str(uuid.uuid4()),
	)
	payment_id = Column(
		String,
		ForeignKey("payments.id", ondelete="CASCADE"),
		nullable=False,
		index=True,
	)
	from_status = Column(
		Enum(PaymentStatus, native_enum=False, length=20),
		nullable=False,
	)
	to_status = Column(
		Enum(PaymentStatus, native_enum=False, length=20),
		nullable=False,
	)
	reason = Column(Text, nullable=True)
	payload = Column(JSON, nullable=True)
	created_at = Column(
		DateTime(timezone=True),
		server_default=func.now(),
		nullable=False,
	)

	payment = relationship("Payment", back_populates="events")


class User(Base):
	"""Application user able to authenticate and own payments."""

	__tablename__ = "users"

	id = Column(
		String,
		primary_key=True,
		default=lambda: str(uuid.uuid4()),
	)
	email = Column(String(255), unique=True, nullable=False, index=True)
	full_name = Column(String(255), nullable=True)
	hashed_password = Column(String(255), nullable=False)
	preferred_currency = Column(String(3), nullable=False, default="USD")
	bank_name = Column(String(255), nullable=True)
	bank_account_number = Column(String(64), nullable=True)
	card_last_four = Column(String(4), nullable=True)
	available_balance = Column(Numeric(14, 2), nullable=False, default=0)
	is_active = Column(Boolean, nullable=False, default=True)
	last_login_at = Column(DateTime(timezone=True), nullable=True)
	created_at = Column(
		DateTime(timezone=True),
		server_default=func.now(),
		nullable=False,
	)
	updated_at = Column(
		DateTime(timezone=True),
		server_default=func.now(),
		onupdate=func.now(),
		nullable=False,
	)

	payments = relationship("Payment", back_populates="user")

