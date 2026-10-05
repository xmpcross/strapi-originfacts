/**
 * Display currencies. Prices are requested from each partner in the chosen
 * currency (Travelpayouts, SerpApi and DataForSEO all convert on their side),
 * never converted here.
 */
export const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'USD';

export const CURRENCY_LABELS: Record<Currency, string> = {
  AUD: '$ AUD',
  USD: '$ USD',
  GBP: '£ GBP',
  EUR: '€ EUR',
};

const PREFIX: Record<Currency, string> = { AUD: 'A$', USD: 'US$', GBP: '£', EUR: '€' };

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

export function toCurrency(value: unknown): Currency {
  return isCurrency(value) ? (String(value).toUpperCase() as Currency) : DEFAULT_CURRENCY;
}

// Euro area (ISO 3166-1 alpha-2), plus countries that use the euro without being members.
const EURO_COUNTRIES = new Set([
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
  'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
]);

/** Default currency for a visitor's country code. */
export function currencyForCountry(countryCode?: string | null): Currency {
  const cc = (countryCode || '').toUpperCase();
  if (cc === 'AU') return 'AUD';
  if (cc === 'GB' || cc === 'IM' || cc === 'JE' || cc === 'GG') return 'GBP';
  if (EURO_COUNTRIES.has(cc)) return 'EUR';
  return 'USD';
}

/** "A$444", "US$310", "£234", "€273". */
export function formatPrice(amount: number, currency: string): string {
  const cur = toCurrency(currency);
  return `${PREFIX[cur]}${Math.round(amount).toLocaleString('en-US')}`;
}
