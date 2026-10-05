'use client';

import { CURRENCIES, CURRENCY_LABELS, type Currency } from '@/lib/currency';
import { setCurrency, useCurrency } from './useCurrency';

/** Site-wide display currency for flight and hotel prices. */
export default function CurrencyPicker({ className = '' }: { className?: string }) {
  const { currency } = useCurrency();
  return (
    <label className={`inline-flex items-center ${className}`}>
      <span className="sr-only">Currency</span>
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value as Currency)}
        className="cursor-pointer rounded-[0.3rem] border border-forest-900/15 bg-white px-2 py-1.5 text-sm font-semibold text-forest-900 hover:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/30"
        data-testid="currency-picker"
        aria-label="Currency for prices"
      >
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {CURRENCY_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
