from cryptography.fernet import Fernet, MultiFernet, InvalidToken
from django.conf import settings
import hashlib
import hmac


class BaseService:
    """Base service class for dependency injection and common utilities."""
    pass


def _fernet():
    """
    MultiFernet over settings.FERNET_KEYS (newest first): encrypt() always
    uses the first key, decrypt() tries each key in turn — this is what
    lets FERNET_KEY be rotated without invalidating previously-encrypted
    ReportIdentity rows. See rotate_fernet_key management command.
    """
    keys = settings.FERNET_KEYS
    fernets = [Fernet(k.encode() if isinstance(k, str) else k) for k in keys]
    return MultiFernet(fernets)


class EncryptionService:
    """
    Handles real encryption/decryption for anonymous identities.

    encrypt()/decrypt() use Fernet (AES-128-CBC + HMAC) via MultiFernet, so
    the stored value is genuinely unreadable without a FERNET_KEYS entry —
    unlike Django's Signer, which only signs plaintext and does not hide it.

    hash_for_lookup() produces a one-way, deterministic HMAC used ONLY to
    answer "does this identity belong to user X" without ever decrypting or
    exposing the underlying user id. It is not reversible.
    """

    @staticmethod
    def encrypt(value: str) -> str:
        return _fernet().encrypt(value.encode()).decode()

    @staticmethod
    def decrypt(value: str):
        try:
            return _fernet().decrypt(value.encode()).decode()
        except (InvalidToken, ValueError, TypeError):
            return None

    @staticmethod
    def generate_placeholder(user_id) -> str:
        """Encrypt the real reporter reference (Layer 2 of the escrow system)."""
        return EncryptionService.encrypt(f"REF_{user_id}")

    @staticmethod
    def hash_for_lookup(user_id) -> str:
        """
        One-way deterministic hash of a user id, used only for
        'is this my report' lookups. Never decryptable back to the user id
        on its own (unlike the old icontains-on-plaintext approach).
        """
        key = settings.IDENTITY_HASH_KEY
        if isinstance(key, str):
            key = key.encode()
        return hmac.new(key, str(user_id).encode(), hashlib.sha256).hexdigest()