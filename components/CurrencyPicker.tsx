'use client';

import { CURRENCIES, CURRENCY_LABELS, type Currency } from '@/lib/currency';
import { setCurrency, useCurrency } from './useCurrency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Site-wide display currency for flight and hotel prices. */
export default function CurrencyPicker({ className = '' }: { className?: string }) {
  const { currency } = useCurrency();
  return (
    <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
      <SelectTrigger
        aria-label="Currency for prices"
        data-testid="currency-picker"
        className={cn(
          // Borderless, with the chevron right after the label (owner's request).
          'h-auto w-auto gap-1 border-0 bg-transparent py-1.5 pl-1 pr-0 text-sm font-semibold text-forest-900 shadow-none hover:text-primary-emphasis focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary-emphasis/30 [&>svg]:opacity-100',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[7.5rem]" data-testid="currency-picker-menu">
        {CURRENCIES.map((code) => (
          <SelectItem key={code} value={code} className="text-sm font-semibold text-forest-900">
            {CURRENCY_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
