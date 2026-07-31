"""
Lightweight magic-byte sniffing for uploaded files. Deliberately hand-rolled
rather than depending on python-magic/libmagic (an OS-level dependency that
complicates deployment) — the app only ever needs to distinguish between a
small, fixed set of evidence file types, so a short signature table is
enough to catch a file whose content doesn't match what its extension or
client-supplied content-type claims.
"""

SIGNATURES = {
    "jpg": [(0, b"\xff\xd8\xff")],
    "jpeg": [(0, b"\xff\xd8\xff")],
    "png": [(0, b"\x89PNG\r\n\x1a\n")],
    "gif": [(0, b"GIF87a"), (0, b"GIF89a")],
    "pdf": [(0, b"%PDF-")],
    "mp4": [(4, b"ftyp")],
    "mp3": [(0, b"ID3"), (0, b"\xff\xfb"), (0, b"\xff\xf3"), (0, b"\xff\xf2")],
    "wav": [(0, b"RIFF")],
}

# Broad category each extension belongs to — matches apps.reports.models.Evidence.file_type.
EXTENSION_CATEGORY = {
    "jpg": "image",
    "jpeg": "image",
    "png": "image",
    "gif": "image",
    "mp4": "video",
    "mp3": "audio",
    "wav": "audio",
    "pdf": "other",
}


def sniff_extension(file) -> str | None:
    """Reads the file's leading bytes and returns the matched extension key, or None."""
    file.seek(0)
    header = file.read(16)
    file.seek(0)

    for ext, signatures in SIGNATURES.items():
        for offset, magic in signatures:
            if header[offset:offset + len(magic)] != magic:
                continue
            if ext == "wav" and header[8:12] != b"WAVE":
                continue
            return ext
    return None


def content_matches_extension(file, claimed_ext: str) -> bool:
    """Whether the file's sniffed content is consistent with its claimed extension's category."""
    claimed_ext = claimed_ext.lower().lstrip(".")
    sniffed = sniff_extension(file)
    if sniffed is None:
        return False
    return EXTENSION_CATEGORY.get(sniffed) == EXTENSION_CATEGORY.get(claimed_ext)
