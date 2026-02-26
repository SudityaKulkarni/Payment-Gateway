
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.db.database import get_db
from app.schemas import schemas
from app.services.security import hash_password, verify_password
from oauth2 import create_access_token, get_current_user


router = APIRouter(prefix="/users", tags=["Users"])



@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
	"""Create a new user after ensuring the email is unique."""
	existing = db.query(models.User).filter(models.User.email == payload.email).first()
	if existing:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="A user with this email already exists",
		)
	user = models.User(
		email=payload.email,
		full_name=payload.full_name,
		preferred_currency=payload.preferred_currency,
		bank_name=payload.bank_name,
		bank_account_number=payload.bank_account_number,
		bank_routing_number=payload.bank_routing_number,
		card_last_four=payload.card_last_four,
		available_balance=payload.available_balance,
		hashed_password=hash_password(payload.password),
	)
	db.add(user)
	db.commit()
	db.refresh(user)
	token = create_access_token({"user_id": user.id})
	return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(current_user: models.User = Depends(get_current_user)):
	"""Return the profile of the authenticated user."""
	return current_user


@router.put("/me", response_model=schemas.UserRead)
def update_current_user(
	updates: schemas.UserUpdate,
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	"""Update the authenticated user's profile fields."""
	if updates.email and updates.email != current_user.email:
		email_exists = db.query(models.User).filter(models.User.email == updates.email).first()
		if email_exists:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail="A user with this email already exists",
			)
		current_user.email = updates.email

	if updates.password:
		current_user.hashed_password = hash_password(updates.password)

	mutable_fields = [
		"full_name",
		"preferred_currency",
		"bank_name",
		"bank_account_number",
		"bank_routing_number",
		"card_last_four",
		"available_balance",
	]
	for field in mutable_fields:
		value = getattr(updates, field)
		if value is not None:
			setattr(current_user, field, value)

	db.commit()
	db.refresh(current_user)
	return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	"""Delete the authenticated user account."""
	db.delete(current_user)
	db.commit()


@router.post("/login", response_model=schemas.Token)
def login_user(
	credentials: schemas.UserLogin,
	db: Session = Depends(get_db),
):
	"""Authenticate a user via JSON payload."""
	username = credentials.email
	password = credentials.password
	user = db.query(models.User).filter(models.User.email == username).first()
	invalid_credentials = HTTPException(
		status_code=status.HTTP_401_UNAUTHORIZED,
		detail="Incorrect email or password",
		headers={"WWW-Authenticate": "Bearer"},
	)
	if not user or not verify_password(password, user.hashed_password):
		raise invalid_credentials
	token = create_access_token({"user_id": user.id})
	return {"access_token": token, "token_type": "bearer"}
