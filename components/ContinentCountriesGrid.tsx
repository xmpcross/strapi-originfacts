'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { StrapiCountry } from '@/lib/strapi';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DISPLAY_LIMIT = 12;

function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function firstLetter(name: string): string {
  const c = (name ?? '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

export default function ContinentCountriesGrid({
  countries,
  regionName,
  hrefByCode,
}: {
  countries: StrapiCountry[];
  regionName: string;
  /** ISO code (upper) → canonical href (destination page when one exists),
   *  computed server-side. Falls back to /countries/<code> when absent. */
  hrefByCode?: Record<string, string>;
}) {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const availableLetters = useMemo(() => {
    const s = new Set<string>();
    for (const c of countries) s.add(firstLetter(c.name));
    return s;
  }, [countries]);

  const filtered = useMemo(() => {
    if (!activeLetter) return countries;
    return countries.filter((c) => firstLetter(c.name) === activeLetter);
  }, [countries, activeLetter]);

  const displayed = expanded ? filtered : filtered.slice(0, DISPLAY_LIMIT);
  const hasMore = filtered.length > DISPLAY_LIMIT;

  return (
    <section className="mx-auto mt-12 max-w-7xl px-6" data-testid="continent-countries">
      <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
        <h2 className="editorial-h text-2xl font-bold text-forest-900">
          Countries in {regionName}
        </h2>
        <span className="text-sm font-light text-forest-900/50">
          {activeLetter
            ? `${filtered.length} of ${countries.length}`
            : `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`}
          {hasMore && !expanded && (
            <span className="ml-2 text-forest-900/40">· showing {DISPLAY_LIMIT}</span>
          )}
        </span>
      </header>

      {countries.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-1" data-testid="continent-countries-letter-filter">
          <span className="mr-2 text-xs uppercase tracking-widest text-forest-900/50">Filter:</span>
          <LetterChip
            label="All"
            active={activeLetter === null}
            onClick={() => setActiveLetter(null)}
          />
          {LETTERS.map((L) => (
            <LetterChip
              key={L}
              label={L}
              active={activeLetter === L}
              disabled={!availableLetters.has(L)}
              onClick={() => setActiveLetter(activeLetter === L ? null : L)}
            />
          ))}
          {availableLetters.has('#') && (
            <LetterChip
              label="#"
              active={activeLetter === '#'}
              onClick={() => setActiveLetter(activeLetter === '#' ? null : '#')}
            />
          )}
        </div>
      )}

      {countries.length === 0 ? (
        <p className="mt-6 text-sm text-forest-900/65">
          No countries published in {regionName} yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-forest-900/65">
          No countries starting with “{activeLetter}”.
        </p>
      ) : (
        <>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayed.map((c) => (
              <li key={c.id}>
                <CountryChip country={c} href={hrefByCode?.[c.code.toUpperCase()]} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-sm font-medium text-forest-700 hover:underline"
                data-testid="continent-countries-view-all"
                aria-expanded={expanded}
              >
                {expanded
                  ? `Show fewer countries ↑`
                  : `View all ${filtered.length} countries →`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LetterChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'h-7 min-w-7 rounded-full border px-2 text-xs font-medium uppercase tracking-wider transition ' +
        (active
          ? 'border-forest-900 bg-forest-900 text-sand-100'
          : disabled
            ? 'border-forest-900/10 text-forest-900/30 cursor-not-allowed'
            : 'border-forest-900/20 text-forest-900/80 hover:border-forest-900/40 hover:bg-forest-900/5')
      }
    >
      {label}
    </button>
  );
}

function CountryChip({ country, href }: { country: StrapiCountry; href?: string }) {
  return (
    <Link
      href={href ?? `/countries/${country.code}`}
      className="group flex items-center gap-3 rounded-lg border border-forest-900/10 bg-paper px-4 py-3 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`continent-country-${country.code}`}
    >
      <span className="text-2xl" aria-hidden>{flagEmoji(country.code)}</span>
      <div className="min-w-0 flex-1">
        <div className="font-urbanist text-sm font-bold text-forest-900 transition group-hover:text-forest-700">
          {country.name}
        </div>
        {country.currency && (
          <div className="mt-0.5 truncate text-xs text-forest-900/60">
            <span className="font-mono">{country.code}</span>
            <span className="ml-2">{country.currency}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
