import { useRef } from 'react';
import { X } from 'lucide-react';
import { ALLOWED_EVIDENCE_EXTENSIONS, validateEvidenceFile } from '../../lib/evidence-constraints';

interface EvidencePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  errors: string[];
  onErrorsChange: (errors: string[]) => void;
}

export function EvidencePicker({ files, onChange, errors, onErrorsChange }: EvidencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const nextErrors: string[] = [];
    const accepted: File[] = [];
    for (const file of Array.from(selected)) {
      const error = validateEvidenceFile(file);
      if (error) {
        nextErrors.push(`${file.name}: ${error}`);
      } else {
        accepted.push(file);
      }
    }
    onChange([...files, ...accepted]);
    onErrorsChange(nextErrors);
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
        accept={ALLOWED_EVIDENCE_EXTENSIONS.join(',')}
        onChange={(e) => handleFiles(e.target.files)}
        className="text-ink-secondary text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black/6 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
      />
      <p className="text-ink-muted text-xs">
        Photos, video, or audio up to 5MB each ({ALLOWED_EVIDENCE_EXTENSIONS.join(', ')}).
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
              className="flex items-center justify-between rounded-lg bg-black/4 px-3 py-1.5 text-sm"
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
