import {
  type CountryFacts,
  flagImageUrl,
  formatPopulation,
} from '@/lib/country-facts';

export default function CountryFactsPanel({
  countryCode,
  facts,
}: {
  countryCode?: string;
  facts: CountryFacts | null;
}) {
  const flagSrc = flagImageUrl(countryCode);
  const rows: { label: string; value: string }[] = [];
  if (facts?.officialName) rows.push({ label: 'Official Name', value: facts.officialName });
  if (facts?.capital) rows.push({ label: 'Capital', value: facts.capital });
  if (facts?.currencyCode)
    rows.push({
      label: 'Currency',
      value: facts.currencyName ? `${facts.currencyName} (${facts.currencyCode})` : facts.currencyCode,
    });
  if (facts?.population != null)
    rows.push({ label: 'Population', value: formatPopulation(facts.population) });
  if (facts?.languages?.length)
    rows.push({ label: 'Official Language', value: facts.languages.join(', ') });
  if (facts?.government) rows.push({ label: 'Government', value: facts.government });
  if (facts?.monarch) rows.push({ label: 'Monarch', value: facts.monarch });
  if (facts?.timezones) rows.push({ label: 'Time Zone', value: facts.timezones });
  if (facts?.drivesOn)
    rows.push({ label: 'Driving Side', value: facts.drivesOn === 'left' ? 'Left' : 'Right' });
  if (facts?.callingCode)
    rows.push({ label: 'International Dialing Code', value: facts.callingCode });

  if (!flagSrc && rows.length === 0) return null;

  return (
    <aside
      data-testid="country-facts-panel"
      className="rounded-lg border border-forest-900/10 bg-paper/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur"
    >
      {flagSrc && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagSrc}
            alt={countryCode ? `${countryCode.toUpperCase()} flag` : 'Flag'}
            width={48}
            height={36}
            className="h-9 w-auto border border-forest-900/10"
            loading="lazy"
          />
          {countryCode && (
            <span className="text-xs font-bold tracking-widest text-forest-900/60">
              {countryCode.toUpperCase()}
            </span>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <dl className="mt-5 divide-y divide-forest-900/10 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
              <dt className="text-xs uppercase tracking-widest text-forest-900/60">{r.label}</dt>
              <dd className="text-right font-bold text-forest-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}
