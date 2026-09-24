from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Fernet cipher for symmetric API key encryption at rest
_fernet_instance: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        key = settings.ENCRYPTION_KEY
        if isinstance(key, str):
            key = key.encode("utf-8")
        _fernet_instance = Fernet(key)
    return _fernet_instance


def encrypt_api_key(plain_key: str) -> str:
    """Encrypts an external chatbot API key for secure storage at rest."""
    if not plain_key:
        return ""
    fernet = _get_fernet()
    encrypted = fernet.encrypt(plain_key.encode("utf-8"))
    return encrypted.decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypts an encrypted API key in memory for outbound requests only.

    NEVER log or return the decrypted value from API endpoints.
    """
    if not encrypted_key:
        return ""
    fernet = _get_fernet()
    decrypted = fernet.decrypt(encrypted_key.encode("utf-8"))
    return decrypted.decode("utf-8")


def mask_api_key(key: str) -> str:
    """Returns a safe display representation of an API key (e.g. 'sk-...12ab')."""
    if not key:
        return ""
    if len(key) <= 8:
        return "********"
    prefix = key[:3] if key.startswith("sk-") else key[:2]
    suffix = key[-4:]
    return f"{prefix}...{suffix}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generates bcrypt hash for password."""
    return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Creates a signed JWT access token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
