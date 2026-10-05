'use client';

import { CURRENCIES, CURRENCY_LABELS, type Currency } from '@/lib/currency';
import { setCurrency, useCurrency } from './useCurrency';

/** Site-wide display currency for flight and hotel prices. */
export default function CurrencyPicker({ className = '' }: { className?: string }) {
  const { currency } = useCurrency();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">Currency</span>
      {/* appearance-none + our own chevron: the native arrow keeps a wide fixed
          gap after the text, which can't be narrowed. */}
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value as Currency)}
        className="cursor-pointer appearance-none rounded-[0.3rem] border-0 bg-transparent py-1.5 pl-1 pr-4 text-sm font-semibold text-forest-900 hover:text-primary-emphasis focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis/30"
        data-testid="currency-picker"
        aria-label="Currency for prices"
      >
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {CURRENCY_LABELS[code]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-forest-900"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </label>
  );
}
