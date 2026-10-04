import React from 'react';

export type CitationSource = {
  title: string;
  url: string;
  domainType: '.gov' | '.edu' | 'Standards Body' | 'UN Agency';
  publisher: string;
  description: string;
};

const FLIGHT_AND_AIRLINE_CITATIONS: CitationSource[] = [
  {
    title: 'U.S. Department of Transportation — Air Consumer Protection',
    url: 'https://www.transportation.gov/airconsumer',
    domainType: '.gov',
    publisher: 'U.S. Department of Transportation (DOT)',
    description: 'Official federal mandates for air passenger rights, flight cancellation refunds, delays, and baggage liability rules.',
  },
  {
    title: 'U.S. Bureau of Transportation Statistics — Air Carrier Data',
    url: 'https://www.bts.gov/topics/airlines-jet-fuel-and-transportation-data',
    domainType: '.gov',
    publisher: 'U.S. Bureau of Transportation Statistics (BTS)',
    description: 'Historical airline on-time performance, flight cancellation rates, jet fuel trends, and traffic metrics.',
  },
  {
    title: 'Federal Aviation Administration — PackSafe Regulations',
    url: 'https://www.faa.gov/hazmat/packsafe',
    domainType: '.gov',
    publisher: 'Federal Aviation Administration (FAA)',
    description: 'Official hazardous materials guidelines, lithium battery carry-on rules, and aircraft cabin safety standards.',
  },
  {
    title: 'European Union Air Passenger Rights (EU261/2004)',
    url: 'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm',
    domainType: '.gov',
    publisher: 'European Commission / European Union',
    description: 'Statutory compensation regulations, assistance mandates, and passenger protections for flights departing or arriving in the EU.',
  },
  {
    title: 'IATA Passenger Experience & Standards',
    url: 'https://www.iata.org/en/programs/passenger/',
    domainType: 'Standards Body',
    publisher: 'International Air Transport Association (IATA)',
    description: 'Global airline industry technical standards, ticketing protocols, and passenger handling guidelines.',
  },
  {
    title: 'MIT International Center for Air Transportation',
    url: 'https://icat.mit.edu/',
    domainType: '.edu',
    publisher: 'Massachusetts Institute of Technology (MIT)',
    description: 'Peer-reviewed academic research on airspace capacity, airline operational efficiency, and environmental aviation policy.',
  },
];

const DESTINATION_AND_TRAVEL_CITATIONS: CitationSource[] = [
  {
    title: 'U.S. Department of State — International Travel Advisories',
    url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html',
    domainType: '.gov',
    publisher: 'U.S. Department of State',
    description: 'Official country-specific risk assessments, entry/exit requirements, visa policies, and consular security alerts.',
  },
  {
    title: 'CDC Travelers\' Health — Destination Guidance',
    url: 'https://wwwnc.cdc.gov/travel',
    domainType: '.gov',
    publisher: 'Centers for Disease Control and Prevention (CDC)',
    description: 'Official travel health notices, required/recommended immunizations, vector-borne disease alerts, and health safety guidelines.',
  },
  {
    title: 'UN Tourism — Global Tourism Statistics Dashboard',
    url: 'https://www.unwto.org/tourism-data/unwto-tourism-dashboard',
    domainType: 'UN Agency',
    publisher: 'World Tourism Organization (UNWTO)',
    description: 'International tourist arrival numbers, economic contribution metrics, and global destination statistics.',
  },
  {
    title: 'World Health Organization — International Travel & Health',
    url: 'https://www.who.int/ith',
    domainType: 'UN Agency',
    publisher: 'World Health Organization (WHO)',
    description: 'Global epidemiological surveillance, yellow fever vaccination mandates, and international sanitary regulations.',
  },
  {
    title: 'Australian Dept of Foreign Affairs — Smartraveller Advisories',
    url: 'https://www.smartraveller.gov.au/',
    domainType: '.gov',
    publisher: 'Australian Department of Foreign Affairs and Trade (DFAT)',
    description: 'Comprehensive travel security advice, dual-national visa regulations, and overseas emergency assistance protocols.',
  },
  {
    title: 'Embry-Riddle Aeronautical University Research',
    url: 'https://erau.edu/research',
    domainType: '.edu',
    publisher: 'Embry-Riddle Aeronautical University',
    description: 'Primary research on global flight safety statistics, airport infrastructure design, and airline route planning.',
  },
];

const GENERAL_CITATIONS: CitationSource[] = [
  {
    title: 'U.S. Department of Transportation — Aviation Consumer Protection',
    url: 'https://www.transportation.gov/airconsumer',
    domainType: '.gov',
    publisher: 'U.S. Department of Transportation (DOT)',
    description: 'Official federal mandates for air passenger rights, baggage liability rules, and refund requirements.',
  },
  {
    title: 'Federal Aviation Administration — Aircraft Safety Standards',
    url: 'https://www.faa.gov/hazmat/packsafe',
    domainType: '.gov',
    publisher: 'Federal Aviation Administration (FAA)',
    description: 'Official passenger safety rules, baggage restriction standards, and dangerous goods policies.',
  },
  {
    title: 'CDC Travelers\' Health Guidelines',
    url: 'https://wwwnc.cdc.gov/travel',
    domainType: '.gov',
    publisher: 'Centers for Disease Control and Prevention (CDC)',
    description: 'Official international health notices, vaccination requirements, and destination safety guidelines.',
  },
  {
    title: 'International Air Transport Association (IATA)',
    url: 'https://www.iata.org/en/programs/passenger/',
    domainType: 'Standards Body',
    publisher: 'IATA',
    description: 'Global technical standards for airline ticketing, luggage dimensions, and carrier interline operations.',
  },
  {
    title: 'MIT International Center for Air Transportation',
    url: 'https://icat.mit.edu/',
    domainType: '.edu',
    publisher: 'MIT ICAT Research Lab',
    description: 'Academic research on airspace logistics, flight network stability, and carrier operational efficiency.',
  },
];

type Props = {
  category?: string;
  customCitations?: CitationSource[];
  title?: string;
  className?: string;
};

export default function OutboundCitations({
  category,
  customCitations,
  title = 'Which verified primary sources & standards support this guide?',
  className = '',
}: Props) {
  let sources = customCitations;

  if (!sources) {
    const cat = (category || '').toLowerCase();
    if (cat.includes('flight') || cat.includes('airline') || cat.includes('airport')) {
      sources = FLIGHT_AND_AIRLINE_CITATIONS;
    } else if (cat.includes('destin') || cat.includes('countr') || cat.includes('hotel') || cat.includes('tip')) {
      sources = DESTINATION_AND_TRAVEL_CITATIONS;
    } else {
      sources = GENERAL_CITATIONS;
    }
  }

  return (
    <section
      aria-labelledby="citations-heading"
      className={`my-12 rounded-xl border border-forest-900/15 bg-forest-50/50 p-6 sm:p-8 ${className}`}
      data-testid="outbound-citations-block"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest-900/10 pb-4">
        <div>
          <span className="font-urbanist text-[11px] font-bold uppercase tracking-widest text-primary-emphasis">
            Fact Checking &amp; Authority
          </span>
          <h3 id="citations-heading" className="editorial-h mt-1 text-xl font-bold text-forest-900 sm:text-2xl">
            {title}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-forest-900/70">
          <span className="rounded-full bg-forest-900/10 px-2.5 py-0.5 text-forest-950 font-mono text-[11px]">.gov</span>
          <span className="rounded-full bg-forest-900/10 px-2.5 py-0.5 text-forest-950 font-mono text-[11px]">.edu</span>
          <span className="rounded-full bg-forest-900/10 px-2.5 py-0.5 text-forest-950 font-mono text-[11px]">ICAO / IATA</span>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-forest-900/70 sm:text-sm">
        Factual statements regarding passenger rights, aircraft safety, baggage allowances, entry visas, and public health advisories on Originfacts are corroborated against primary government portals, statutory civil aviation authorities, and peer-reviewed educational research.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {sources.map((src, idx) => (
          <li key={idx} className="flex flex-col justify-between rounded-lg border border-forest-900/10 bg-white p-4 transition hover:border-forest-900/30 hover:shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-urbanist text-[11px] font-bold uppercase tracking-wider text-forest-900/60">
                  {src.publisher}
                </span>
                <span className="rounded bg-primary-emphasis/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-emphasis">
                  {src.domainType}
                </span>
              </div>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block font-urbanist text-sm font-bold text-forest-950 transition hover:text-primary-emphasis hover:underline"
              >
                {src.title} <span aria-hidden="true" className="inline-block text-xs">↗</span>
              </a>
              <p className="mt-2 text-xs leading-5 text-forest-900/70">
                {src.description}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-forest-900/5 text-[11px] font-mono text-forest-900/50 truncate">
              {src.url}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
