import os
from apps.core.file_validation import EXTENSION_CATEGORY, content_matches_extension

ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.pdf', '.webm', '.weba']
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def validate_evidence_file(file) -> str:
    """
    Validates an uploaded evidence file's extension, size, and magic bytes.
    Returns the Evidence.file_type category to store. Raises ValueError with
    a user-facing message on any failure — callers adapt it to their own
    response shape.
    """
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}')

    if file.size > MAX_FILE_SIZE:
        raise ValueError(f'File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB.')

    if not content_matches_extension(file, ext):
        raise ValueError("This file's content doesn't match its extension.")

    return EXTENSION_CATEGORY[ext.lstrip('.')]
