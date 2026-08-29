import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ALLOWED_EVIDENCE_EXTENSIONS, MAX_EVIDENCE_FILE_SIZE, validateEvidenceFile } from '../../lib/evidence-constraints';
import { compressImageFileIfNeeded } from '../../lib/image-compression';

interface EvidencePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  errors: string[];
  onErrorsChange: (errors: string[]) => void;
}

export function EvidencePicker({ files, onChange, errors, onErrorsChange }: EvidencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  async function handleFiles(selected: FileList | null) {
    if (!selected) return;
    setCompressing(true);
    const nextErrors: string[] = [];
    const accepted: File[] = [];
    for (const original of Array.from(selected)) {
      // Compress before validating size — a large JPEG that compresses
      // under the limit should be accepted, not rejected for a size it no
      // longer has by the time it's uploaded.
      // eslint-disable-next-line no-await-in-loop
      const file = await compressImageFileIfNeeded(original);
      const error = validateEvidenceFile(file);
      if (error) {
        nextErrors.push(`${original.name}: ${error}`);
      } else {
        accepted.push(file);
      }
    }
    onChange([...files, ...accepted]);
    onErrorsChange(nextErrors);
    setCompressing(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={compressing}
        accept={ALLOWED_EVIDENCE_EXTENSIONS.join(',')}
        onChange={(e) => void handleFiles(e.target.files)}
        className="text-ink-secondary text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink/6 file:px-3 file:py-1.5 file:text-sm file:font-semibold disabled:opacity-50"
      />
      <p className="text-ink-muted text-xs">
        {compressing
          ? 'Compressing large photos…'
          : `Photos, video, or audio up to ${MAX_EVIDENCE_FILE_SIZE / (1024 * 1024)}MB each (${ALLOWED_EVIDENCE_EXTENSIONS.join(', ')}). Large photos are compressed automatically.`}
      </p>

      {errors.length > 0 && (
        <ul className="text-status-critical text-xs">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-lg bg-ink/4 px-3 py-1.5 text-sm"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
                className="text-ink-muted hover:text-status-critical shrink-0"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
