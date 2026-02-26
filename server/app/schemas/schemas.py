from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, condecimal, constr

from ..models.models import PaymentStatus


AmountType = condecimal(gt=Decimal("0.00"), max_digits=12, decimal_places=2)
BalanceType = condecimal(ge=Decimal("0.00"), max_digits=14, decimal_places=2)
CurrencyType = Literal["USD", "EUR", "GBP", "INR", "JPY", "AUD"]
PasswordType = constr(strip_whitespace=True, min_length=8, max_length=128)


class UserBase(BaseModel):
	email: EmailStr
	full_name: Optional[str] = None
	preferred_currency: CurrencyType = "USD"
	bank_name: Optional[str] = None
	bank_account_number: Optional[constr(strip_whitespace=True, min_length=4, max_length=64)] = None
	bank_routing_number: Optional[constr(strip_whitespace=True, min_length=4, max_length=64)] = None
	card_last_four: Optional[constr(strip_whitespace=True, min_length=4, max_length=4)] = None
	available_balance: BalanceType = Decimal("0.00")


class UserCreate(UserBase):
	password: PasswordType


class UserLogin(BaseModel):
	email: EmailStr
	password: PasswordType


class UserRead(UserBase):
	model_config = ConfigDict(from_attributes=True)

	id: str
	is_active: bool
	last_login_at: Optional[datetime] = None
	created_at: datetime
	updated_at: datetime


class PaymentBase(BaseModel):
	amount: AmountType
	currency: CurrencyType = "USD"
	description: Optional[str] = Field(default=None, max_length=255)
	customer_email: Optional[EmailStr] = None
	extra_data: Optional[Dict[str, Any]] = Field(default=None)
	webhook_url: Optional[HttpUrl] = None


class PaymentCreate(PaymentBase):
	payment_reference: constr(strip_whitespace=True, min_length=1, max_length=64)


class PaymentStatusUpdate(BaseModel):
	status: PaymentStatus
	failure_reason: Optional[str] = Field(default=None, max_length=255)
	rule_triggered: Optional[str] = Field(default=None, max_length=64)
	fraud_flag: Optional[bool] = None


class PaymentEventRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	from_status: PaymentStatus
	to_status: PaymentStatus
	reason: Optional[str] = None
	payload: Optional[Dict[str, Any]] = None
	created_at: datetime


class PaymentRead(PaymentBase):
	model_config = ConfigDict(from_attributes=True)

	id: str
	payment_reference: str
	status: PaymentStatus
	failure_reason: Optional[str] = None
	rule_triggered: Optional[str] = None
	retry_count: int
	fraud_flag: bool
	extra_data: Optional[Dict[str, Any]] = None
	processing_started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	created_at: datetime
	updated_at: datetime
	user_id: Optional[str] = None
	user: Optional[UserRead] = None
	events: List[PaymentEventRead] = Field(default_factory=list)


class PaymentSummary(BaseModel):
	total: int
	success: int
	failed: int
	refunded: int
	processing: int
	created: int
	failure_breakdown: Dict[str, int]
	last_updated: datetime
