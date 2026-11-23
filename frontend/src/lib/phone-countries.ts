export interface PhoneCountry {
  iso2: string;
  name: string;
  dialCode: string;
  /** National-number digit count (0-leading trunk prefix already stripped). */
  minDigits: number;
  maxDigits: number;
}

// A curated list, not the full ISO-3166 set — East Africa (this
// university's primary user base) first, then other common origins.
// phone_number is a CharField(max_length=15) on the backend, so every
// dial code + max digit count here stays comfortably under that once the
// leading "+" is added.
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso2: 'UG', name: 'Uganda', dialCode: '256', minDigits: 9, maxDigits: 9 },
  { iso2: 'KE', name: 'Kenya', dialCode: '254', minDigits: 9, maxDigits: 9 },
  { iso2: 'TZ', name: 'Tanzania', dialCode: '255', minDigits: 9, maxDigits: 9 },
  { iso2: 'RW', name: 'Rwanda', dialCode: '250', minDigits: 9, maxDigits: 9 },
  { iso2: 'SS', name: 'South Sudan', dialCode: '211', minDigits: 9, maxDigits: 9 },
  { iso2: 'BI', name: 'Burundi', dialCode: '257', minDigits: 8, maxDigits: 8 },
  { iso2: 'CD', name: 'DR Congo', dialCode: '243', minDigits: 9, maxDigits: 9 },
  { iso2: 'ET', name: 'Ethiopia', dialCode: '251', minDigits: 9, maxDigits: 9 },
  { iso2: 'SD', name: 'Sudan', dialCode: '249', minDigits: 9, maxDigits: 9 },
  { iso2: 'SO', name: 'Somalia', dialCode: '252', minDigits: 8, maxDigits: 9 },
  { iso2: 'NG', name: 'Nigeria', dialCode: '234', minDigits: 10, maxDigits: 10 },
  { iso2: 'GH', name: 'Ghana', dialCode: '233', minDigits: 9, maxDigits: 9 },
  { iso2: 'ZA', name: 'South Africa', dialCode: '27', minDigits: 9, maxDigits: 9 },
  { iso2: 'EG', name: 'Egypt', dialCode: '20', minDigits: 10, maxDigits: 10 },
  { iso2: 'US', name: 'United States', dialCode: '1', minDigits: 10, maxDigits: 10 },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '44', minDigits: 10, maxDigits: 10 },
  { iso2: 'CA', name: 'Canada', dialCode: '1', minDigits: 10, maxDigits: 10 },
  { iso2: 'IN', name: 'India', dialCode: '91', minDigits: 10, maxDigits: 10 },
  { iso2: 'CN', name: 'China', dialCode: '86', minDigits: 11, maxDigits: 11 },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '971', minDigits: 9, maxDigits: 9 },
  { iso2: 'AU', name: 'Australia', dialCode: '61', minDigits: 9, maxDigits: 9 },
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountry =
  PHONE_COUNTRIES.find((c) => c.iso2 === 'UG') ?? PHONE_COUNTRIES[0];

export function findPhoneCountry(iso2: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.iso2 === iso2) ?? DEFAULT_PHONE_COUNTRY;
}

/** Regional-indicator flag emoji, computed from the ISO2 code — no image assets needed. */
export function countryFlagEmoji(iso2: string): string {
  return String.fromCodePoint(...iso2.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
}

/** Strips everything but digits, and one leading trunk "0" (the common local-format prefix). */
export function normalizeNationalDigits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

export function isValidNationalNumber(country: PhoneCountry, raw: string): boolean {
  const digits = normalizeNationalDigits(raw);
  return digits.length >= country.minDigits && digits.length <= country.maxDigits;
}

/** Combines into the plain E.164-ish string the backend stores, e.g. "+256701234567". */
export function toE164(country: PhoneCountry, raw: string): string {
  return `+${country.dialCode}${normalizeNationalDigits(raw)}`;
}
