from django.core.signing import Signer, BadSignature
from django.conf import settings
import json

class BaseService:
    """Base service class for dependency injection and common utilities."""
    pass

class EncryptionService:
    """Handles encryption/decryption for anonymous identities."""
    
    @staticmethod
    def encrypt(value):
        """Encrypt a value using Django's signing (simple but secure enough)."""
        signer = Signer()
        return signer.sign(value)
    
    @staticmethod
    def decrypt(value):
        """Decrypt a signed value. Returns None if invalid."""
        try:
            signer = Signer()
            return signer.unsign(value)
        except BadSignature:
            return None
    
    @staticmethod
    def generate_placeholder(user_id):
        """Generate a placeholder encrypted reference (Phase 1)."""
        return EncryptionService.encrypt(f"REF_{user_id}")
