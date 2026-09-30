"""
Shared FastAPI dependencies: DB session re-export, and current-user
resolution from the bearer token.
"""
import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
        user_id = uuid.UUID(user_id)
    except (jwt.PyJWTError, ValueError) as exc:
        raise credentials_error from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    return user


def require_role(*allowed_roles: str):
    """Dependency factory: gate a route to specific user roles.

    Usage: `Depends(require_role("doctor", "admin"))`
    """

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(allowed_roles)}",
            )
        return user

    return _check
