import { describe, expect, it } from 'vitest';
import { MAX_EVIDENCE_FILE_SIZE, validateEvidenceFile } from './evidence-constraints';

function makeFile(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}

describe('validateEvidenceFile', () => {
  it('accepts an allowed extension within the size limit', () => {
    expect(validateEvidenceFile(makeFile('photo.jpg', 1024))).toBeNull();
  });

  it('is case-insensitive on extension', () => {
    expect(validateEvidenceFile(makeFile('photo.JPG', 1024))).toBeNull();
  });

  it('rejects a disallowed extension', () => {
    const result = validateEvidenceFile(makeFile('malware.exe', 1024));
    expect(result).toMatch(/File type not allowed/);
  });

  it('rejects a file over the size limit', () => {
    const result = validateEvidenceFile(makeFile('photo.jpg', MAX_EVIDENCE_FILE_SIZE + 1));
    expect(result).toMatch(/File too large/);
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateEvidenceFile(makeFile('photo.jpg', MAX_EVIDENCE_FILE_SIZE))).toBeNull();
  });
});
