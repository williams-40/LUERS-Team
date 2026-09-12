// Mirrors ALLOWED_EXTENSIONS / MAX_FILE_SIZE in backend/apps/reports/validators.py exactly,
// so users get instant feedback instead of a round trip to the server.
// .webm/.weba are MediaRecorder's own output formats for in-browser video/
// voice recording (see MediaRecorderControl.tsx) — not user-picked files.
export const ALLOWED_EVIDENCE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.pdf', '.webm', '.weba',
];
export const MAX_EVIDENCE_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
