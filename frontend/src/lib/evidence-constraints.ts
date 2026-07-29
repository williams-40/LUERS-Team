// Mirrors ALLOWED_EXTENSIONS / MAX_FILE_SIZE in backend/apps/reports/views.py exactly,
// so users get instant feedback instead of a round trip to the server.
export const ALLOWED_EVIDENCE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.pdf'];
export const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateEvidenceFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EVIDENCE_EXTENSIONS.includes(ext)) {
    return `File type not allowed. Allowed: ${ALLOWED_EVIDENCE_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    return `File too large. Maximum size is ${MAX_EVIDENCE_FILE_SIZE / (1024 * 1024)}MB.`;
  }
  return null;
}
