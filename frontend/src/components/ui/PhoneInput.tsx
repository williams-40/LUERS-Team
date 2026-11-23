import { useId } from 'react';
import { PHONE_COUNTRIES, countryFlagEmoji, findPhoneCountry, type PhoneCountry } from '../../lib/phone-countries';
import { cn } from '../../lib/utils';

export interface PhoneInputProps {
  id?: string;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  country: PhoneCountry;
  nationalNumber: string;
  onCountryChange: (country: PhoneCountry) => void;
  onNationalNumberChange: (value: string) => void;
}

/**
 * Country-code picker + national-number field, combined into one control.
 * Splits the value in two so validation (see lib/phone-countries.ts) can
 * check the national number against that country's real digit count
 * instead of just "is this a plausible-looking string."
 */
export function PhoneInput({
  id,
  label,
  required,
  error,
  helperText,
  country,
  nationalNumber,
  onCountryChange,
  onNationalNumberChange,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-ink-secondary text-[12.5px] font-semibold">
          {label}
          {required && <span className="text-status-critical ml-0.5">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={country.iso2}
          onChange={(e) => onCountryChange(findPhoneCountry(e.target.value))}
          className="select-chevron bg-surface-2 text-ink w-[6.5rem] shrink-0 appearance-none rounded-lg border-[1.5px] border-ink/15 py-2.5 pl-2.5 text-sm outline-none transition focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/30"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {countryFlagEmoji(c.iso2)} +{c.dialCode}
            </option>
          ))}
        </select>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(errorId, helperId) || undefined}
          value={nationalNumber}
          onChange={(e) => onNationalNumberChange(e.target.value)}
          placeholder="7XXXXXXXX"
          className={cn(
            'border-[1.5px] border-ink/15 bg-surface-2 text-ink w-full min-w-0 appearance-none rounded-lg px-3.5 py-2.5 text-sm outline-none transition',
            'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/30',
            error && 'border-status-critical focus-visible:border-status-critical focus-visible:outline-status-critical/30',
          )}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-status-critical text-[12.5px]">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helperId} className="text-ink-muted text-[12.5px]">
          {helperText}
        </p>
      )}
    </div>
  );
}
