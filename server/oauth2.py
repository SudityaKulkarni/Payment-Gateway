import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app import models
from app.db.database import get_db
from app.schemas import schemas


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-prod")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Generate a signed JWT embedding the provided payload."""
    to_encode = data.copy()
    expire_window = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": datetime.utcnow() + expire_window})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str, credentials_exception: HTTPException) -> schemas.TokenData:
    """Decode and validate an incoming bearer token, returning its payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id") or payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return schemas.TokenData(id=str(user_id))
    except JWTError as exc:  # pragma: no cover - relies on external lib exceptions
        raise credentials_exception from exc


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """FastAPI dependency returning the authenticated `User` model."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    parsed_token = verify_access_token(token, credentials_exception)
    user = db.query(models.User).filter(models.User.id == parsed_token.id).first()
    if user is None:
        raise credentials_exception
    return user
