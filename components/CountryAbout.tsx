import type { ReactNode } from 'react';

type Section = { heading: string | null; paragraphs: string[] };

function isWikipediaUrl(url: string): boolean {
  try {
    return /(^|\.)wikipedia\.org$/i.test(new URL(url).hostname);
  } catch {
    return /wikipedia\.org/i.test(url);
  }
}

/** Turn a bullet of the form `domain.tld — description` into a clickable link.
 *  Also handles plain markdown links `[text](https://url)`. Falls back to the
 *  raw text when neither pattern matches. */
export function renderBulletContent(text: string): ReactNode {
  const md = text.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)(.*)$/);
  if (md) {
    const [, label, url, rest] = md;
    if (isWikipediaUrl(url)) {
      return `${label}${rest}`;
    }
    return (
      <>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-emphasis underline hover:text-primary-highlight"
        >
          {label}
        </a>
        {rest}
      </>
    );
  }
  const domain = text.match(/^((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+)(\s+[—-]\s+.+)$/i);
  if (domain) {
    const [, host, rest] = domain;
    const href = host.startsWith('http') ? host : `https://${host}`;
    if (isWikipediaUrl(href)) {
      return rest.replace(/^\s+[—-]\s+/, '');
    }
    return (
      <>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-emphasis underline hover:text-primary-highlight"
        >
          {host}
        </a>
        {rest}
      </>
    );
  }
  return text;
}

export default function CountryAbout({
  sections,
  singleColumnBullets = false,
  headingAs = 'h3',
}: {
  sections: Section[];
  /** h2 when the sections are the page's own top-level guide sections. */
  headingAs?: 'h2' | 'h3';
  /** Disable the automatic 2-col layout for long bullet lists. Useful when the
   *  parent already places the section in a narrow column. */
  singleColumnBullets?: boolean;
}) {
  if (sections.length === 0) return null;

  return (
    <div
      className="prose-article w-full"
      style={{ maxWidth: '100%' }}
      data-testid="country-about-content"
    >
      {sections.map((s, i) => (
        <SectionBlock
          key={i}
          section={s}
          first={i === 0}
          singleColumnBullets={singleColumnBullets}
          headingAs={headingAs}
        />
      ))}
    </div>
  );
}

function SectionBlock({
  section,
  first,
  singleColumnBullets,
  headingAs: Heading,
}: {
  section: Section;
  first: boolean;
  singleColumnBullets: boolean;
  headingAs: 'h2' | 'h3';
}) {
  return (
    <div className={first ? '' : 'mt-8'}>
      {section.heading && (
        <Heading
          className={`${first ? '!mt-0 ' : ''}${Heading === 'h2' ? 'editorial-h text-2xl' : 'text-xl'} font-bold text-forest-900`}
        >
          {section.heading}
        </Heading>
      )}
      {section.paragraphs.map((p, i) => {
        const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
        const isBulletList = lines.length > 1 && lines.every((l) => /^[-*]\s+/.test(l));
        if (isBulletList) {
          const twoCol = !singleColumnBullets && lines.length >= 4;
          const baseClass = section.heading && i === 0 ? 'mt-3' : '';
          const colClass = twoCol ? 'sm:columns-2 sm:gap-x-8' : '';
          return (
            <ul
              key={i}
              className={`!list-none !pl-0 !ps-0 !ml-0 ${baseClass} ${colClass}`.trim()}
              style={twoCol ? { columnFill: 'balance' } : undefined}
            >
              {lines.map((l, j) => (
                <li key={j} className={twoCol ? 'break-inside-avoid' : undefined}>
                  {renderBulletContent(l.replace(/^[-*]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={section.heading && i === 0 ? 'mt-3' : ''}>
            {p}
          </p>
        );
      })}
    </div>
  );
}
