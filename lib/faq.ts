/**
 * The site-wide FAQ (/faq): one source of truth for the visible questions and
 * the FAQPage JSON-LD, so the schema cannot drift from what readers see.
 *
 * Every answer restates something the site already says or does — the About
 * page, /methodology, content/legal/*, the airline fact-store rules
 * (content/airline-facts/CLAUDE.md) or the code behind a feature. Do not add an
 * answer you cannot point to in the repo: this is a live affiliate site with a
 * no-invented-facts rule. Numbers are passed in (FaqCounts), never typed here.
 *
 * Answers are lists of segments rather than JSX so the same data renders as
 * links on the page and flattens to identical plain text for the schema.
 */
import type { Faq } from '@/lib/entity-seo';

export type FaqSegment =
  | string
  | { text: string; href: string }
  /** Inline button that reopens the cookie-consent dialog. */
  | { text: string; action: 'cookie-settings' };

export type FaqItem = { id: string; q: string; a: FaqSegment[] };

export type FaqGroup = {
  id: string;
  title: string;
  intro: string;
  items: FaqItem[];
};

/** Counted at render time from the same data the directory pages use. 0 = unknown. */
export type FaqCounts = {
  articles: number;
  airlines: number;
  airlineCountries: number;
  verifiedAirlineGuides: number;
  airports: number;
};

const CONTACT_EMAIL = 'contact@originfacts.com';
const SUPPORT_EMAIL = 'support@fxnholdings.com';

const mail = (address: string, subject?: string): FaqSegment => ({
  text: address,
  href: `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`,
});

const fmt = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

export function buildFaqGroups(c: FaqCounts): FaqGroup[] {
  const groups: FaqGroup[] = [
    {
      id: 'using-originfacts',
      title: 'Using Originfacts',
      intro: 'What the site is, who runs it, and how the content is made.',
      items: [
        {
          id: 'what-is-originfacts',
          q: 'What is Originfacts?',
          a: [
            'Originfacts is an independent travel website that pairs the facts behind destinations — their stories, cultures and histories — with practical guides to flights, airports, airlines and hotels. It is a travel information and affiliate aggregation website, not a travel agent. Read more ',
            { text: 'about Originfacts', href: '/about' },
            '.',
          ],
        },
        {
          id: 'who-operates-originfacts',
          q: 'Who operates Originfacts?',
          a: [
            'Originfacts is operated by FXN Holdings (ABN 53 274 423 748), an Australian business with its mailing address at PO Box 500, West Perth WA 6872, Australia. Full business details are in our ',
            { text: 'Legal Notice', href: '/legal/contact' },
            '.',
          ],
        },
        {
          id: 'what-does-originfacts-cover',
          q: 'What does Originfacts cover?',
          a: [
            `Destination guides, flights, hotels, airlines, airports and travel tips${
              c.articles > 0 ? `, across ${plural(c.articles, 'published article')}` : ''
            }. You can browse `,
            { text: 'destinations', href: '/destinations' },
            ', ',
            { text: 'countries', href: '/countries' },
            ', ',
            { text: 'airlines', href: '/airlines' },
            ', ',
            { text: 'airports', href: '/airports' },
            ' and ',
            { text: 'flight routes', href: '/flight-routes' },
            ', or read ',
            { text: 'all articles', href: '/all-articles' },
            '.',
          ],
        },
        {
          id: 'find-an-article',
          q: 'How do I find a specific guide or article?',
          a: [
            'Use ',
            { text: 'site search', href: '/search' },
            ' to look up articles by keyword, or browse the ',
            { text: 'site map', href: '/sitemap' },
            '. New posts are also published to our ',
            { text: 'RSS feed', href: '/feed.xml' },
            '.',
          ],
        },
        {
          id: 'is-content-written-by-ai',
          q: 'Is Originfacts content written with AI?',
          a: [
            "In part. Many articles are drafted with a large language model (currently Anthropic's Claude), which is given a brief, editorial guidelines and structured prompts. Our ",
            { text: 'editorial methodology', href: '/methodology' },
            ' requires published content to be reviewed and fact-checked by human editors. Author profiles are on the ',
            { text: 'Authors', href: '/authors' },
            ' page.',
          ],
        },
        {
          id: 'are-images-real-photos',
          q: 'Are the images on Originfacts real photographs?',
          a: [
            'Not always. Cover and gallery images are often produced with generative image models (currently Fal.ai FLUX); real photographs are used where licensing permits. AI-generated images illustrate an article — they are not meant to show a specific hotel, aircraft, price or person.',
          ],
        },
        {
          id: 'are-best-lists-tested',
          q: 'Are “best” and “top” lists based on hands-on testing?',
          a: [
            'No. Ranked and “best of” articles are editorial selections compiled from published fare and route data, official airline and hotel policies and the sources listed in our ',
            { text: 'methodology', href: '/methodology' },
            '. They are not the result of hands-on product testing, mystery shopping or paid stays.',
          ],
        },
        {
          id: 'how-up-to-date',
          q: 'How up to date is the information?',
          a: [
            'We revisit and update articles as prices, routes and policies change. Facts that change often — prices, routes, visa rules and fees — are the most likely to go out of date, so confirm them with the provider or an official source before you book or travel.',
          ],
        },
        {
          id: 'is-it-advice',
          q: 'Is Originfacts travel, visa or legal advice?',
          a: [
            'No. Content on Originfacts is general information only. It is not legal, immigration, visa, health, safety, medical, tax, insurance or financial advice. Check important details with official sources, government authorities or your travel provider. See our ',
            { text: 'Disclaimer', href: '/legal/disclaimer' },
            '.',
          ],
        },
        {
          id: 'languages',
          q: 'Which languages is Originfacts published in?',
          a: ['Originfacts is written for readers around the world and is currently published in English.'],
        },
      ],
    },
    {
      id: 'airline-airport-data',
      title: 'Airline & airport data',
      intro: 'Where airline facts come from, and what the labels on airline pages mean.',
      items: [
        {
          id: 'where-airline-facts-come-from',
          q: 'Where does the airline information come from?',
          a: [
            "Baggage, carry-on, fare and check-in details come only from the airline's own conditions of carriage and help pages. Passenger-rights information comes from named regulators. “Where they fly” statistics come from the Originfacts route dataset, built from Travelpayouts route data and labelled with its date. Links to each airline's conditions of carriage come from Duffel's airline reference data.",
          ],
        },
        {
          id: 'what-verified-means',
          q: 'What does “Verified” mean on an airline page?',
          a: [
            "A Verified stamp means every figure in that section was taken from an official source — the airline's own published page or a named regulator — and is shown with its source link and the date it was checked. A figure that could not be traced to an official source is left blank rather than estimated.",
          ],
        },
        {
          id: 'not-yet-verified',
          q: 'Why does an airline section say “Not yet verified”?',
          a: [
            'A section publishes only when every figure it needs has been confirmed against an official source. Until then it stays unpublished instead of showing an estimate or a number copied from another website. We would rather show what we do not know than print a plausible wrong figure.',
          ],
        },
        {
          id: 'sources-disagree',
          q: 'What does “Sources disagree” mean?',
          a: [
            "Credible sources give different answers for the same figure. Neither value is published as settled; the page shows both readings instead, so you can confirm the right one with the airline.",
          ],
        },
        ...(c.airlines > 0
          ? [
              {
                id: 'how-many-airlines',
                q: 'How many airlines are in the directory?',
                a: [
                  'The ',
                  { text: 'airline directory', href: '/airlines' },
                  ` currently lists ${plural(c.airlines, 'passenger airline')}${
                    c.airlineCountries > 0 ? ` from ${plural(c.airlineCountries, 'country', 'countries')}` : ''
                  }${
                    c.verifiedAirlineGuides > 0
                      ? `, and ${fmt(c.verifiedAirlineGuides)} of them ${c.verifiedAirlineGuides === 1 ? 'has' : 'have'} a verified policy guide`
                      : ''
                  }. You can search it by airline name, IATA code or country.`,
                ],
              } satisfies FaqItem,
            ]
          : []),
        {
          id: 'who-is-excluded',
          q: 'Which organisations are left out of the airline directory?',
          a: [
            'Organisations that hold an IATA designator but do not operate flights — railways, ferry operators, reservation-system vendors, trade bodies and military units — are excluded. Cargo-only carriers are not listed in the directory either.',
          ],
        },
        {
          id: 'ceased-airlines',
          q: 'What happens to airlines that have stopped flying?',
          a: [
            'Their pages carry a notice with the cessation date recorded in Wikidata and a link to that record, and the flight-booking tools are removed from the page. Carriers whose status we cannot source are shown without a label rather than guessed at.',
          ],
        },
        {
          id: 'route-data-is-not-a-fleet-list',
          q: 'Is the route and aircraft information a current schedule or fleet list?',
          a: [
            "No. It comes from the Originfacts route dataset, which accumulates over time. It is not a fleet register: it can name aircraft types an airline has retired and miss recent additions. Check the airline's own website for current schedules and aircraft.",
          ],
        },
        {
          id: 'airline-phone-numbers',
          q: 'Are the airline phone numbers on Originfacts official?',
          a: [
            "We publish an airline phone number or address only when it comes from the airline's own website. Contact details found only in third-party directories are withheld, which helps you avoid fake airline helplines.",
          ],
        },
        {
          id: 'compensation',
          q: 'Can Originfacts tell me if I am owed compensation for a delay or cancellation?',
          a: [
            "No. We don't give advice on individual claims. Where an airline page publishes its delays and cancellations section, it names the passenger-rights framework that may apply and links to the airline's own disruption pages and the relevant regulator. The airline's conditions of carriage and the regulator are the places to check what you are entitled to.",
          ],
        },
        {
          id: 'airport-directory',
          q: 'What is in the airport directory?',
          a: [
            'The ',
            { text: 'airport directory', href: '/airports' },
            ` lists ${c.airports > 0 ? `${plural(c.airports, 'airport')}` : 'airports'} with their IATA and ICAO codes, city and country. For the major connecting airports, see `,
            { text: 'international airport hubs', href: '/airports/hubs' },
            '.',
          ],
        },
      ],
    },
    {
      id: 'prices-bookings',
      title: 'Prices & bookings',
      intro: 'How search and prices work, and who to talk to about a booking.',
      items: [
        {
          id: 'does-originfacts-sell-tickets',
          q: 'Does Originfacts sell tickets or take bookings?',
          a: [
            "No. Originfacts does not sell travel bookings, take payments, issue tickets, operate airlines or hotels, process refunds or handle cancellations. When you choose a flight, hotel, tour or other service, you are taken to the provider's website and your booking is made directly with that provider.",
          ],
        },
        {
          id: 'how-to-search-flights',
          q: 'How do I search for flights?',
          a: [
            'Open ',
            { text: 'Flight Search', href: '/flight-search' },
            " and enter your departure airport, destination, dates and number of passengers. The search is run by our flight-search partner, Travelpayouts, and shows fares from airlines and travel agencies in one place. When you choose a fare you complete the booking on the seller's website, so compare nearby dates and check baggage fees before you book.",
          ],
        },
        {
          id: 'cheapest-dates',
          q: 'How can I see which dates are cheapest on a route?',
          a: [
            'Each page in ',
            { text: 'Flight Routes', href: '/flight-routes' },
            ' includes a price calendar from our flight-search partner showing fares by date for that route. Click a date to open the search for that fare.',
          ],
        },
        {
          id: 'are-prices-guaranteed',
          q: 'Are the prices on Originfacts guaranteed?',
          a: [
            "No. Prices shown on Originfacts may be live, estimated, cached, promotional, currency-converted or based on provider data at the time of search, and they change quickly. The final price is the one on the provider's booking page.",
          ],
        },
        {
          id: 'why-price-changes',
          q: 'Why is the price different when I click through?',
          a: [
            "Prices and availability depend on dates, demand, currency, taxes, fees, provider rules, device, region, loyalty status and other factors, and a fare can sell out between your search and the booking page. Treat the provider's checkout page as the final source for the current price.",
          ],
        },
        {
          id: 'currency',
          q: 'Can I see prices in my own currency?',
          a: [
            'The search on ',
            { text: 'Flight Search', href: '/flight-search' },
            " has a currency selector. Prices elsewhere on the site may be converted from another currency, so check the final amount and currency on the provider's page.",
          ],
        },
        {
          id: 'departure-airport-suggestion',
          q: 'Why does the site suggest a departure airport near me?',
          a: [
            'Some flight widgets estimate the airport nearest to you from your approximate location, based on your IP address, and use a default airport if that fails. It is only a starting point — you can enter any departure airport in Flight Search.',
          ],
        },
        {
          id: 'check-before-booking',
          q: 'What should I check before I book?',
          a: [
            "On the provider's website, check the final price, taxes, fees, cancellation rules, refund terms, baggage rules and deposit requirements, plus any other conditions that apply to your booking.",
          ],
        },
        {
          id: 'booking-problems',
          q: 'Who do I contact about a booking, refund or cancellation?',
          a: [
            'The company you booked with. Originfacts does not handle bookings, payments or refunds, and your contract is with the provider — so questions about a ticket, hotel, rental or tour go to them.',
          ],
        },
        {
          id: 'tours-and-activities',
          q: 'Where do the links to tours and activities go?',
          a: [
            'Destination guides link to tours and activities on GetYourGuide, one of our affiliate partners. You book and pay on GetYourGuide, under its own terms.',
          ],
        },
      ],
    },
    {
      id: 'affiliate-links',
      title: 'Affiliate links & money',
      intro: 'How Originfacts is funded, and what that means for what you see.',
      items: [
        {
          id: 'do-you-earn-commission',
          q: 'Does Originfacts earn money when I book?',
          a: [
            'Sometimes. Some links, buttons, widgets and search results on Originfacts are affiliate links. If you click one and later book or buy from the provider, we may earn a commission. Our affiliate partners are Travelpayouts, Takeads and GetYourGuide.',
          ],
        },
        {
          id: 'do-i-pay-more',
          q: 'Will I pay more if I book through an Originfacts link?',
          a: ['An affiliate commission normally does not increase the price you pay.'],
        },
        {
          id: 'does-it-affect-content',
          q: 'Do affiliate relationships affect what Originfacts shows?',
          a: [
            'They can. Affiliate relationships may influence which providers, links, widgets or offers appear, whether a link earns us money, and in some cases how results or comparison tables are displayed. We aim to label affiliate, sponsored and commercial content clearly. Read our ',
            { text: 'Affiliate Disclosure', href: '/legal/affiliate-disclosure' },
            '.',
          ],
        },
        {
          id: 'ranking-words',
          q: 'What do words like “cheapest”, “best” or “recommended” mean?',
          a: [
            'They are based on available data, your search criteria, provider information, affiliate feeds, editorial judgment, or commercial relationships where applicable. Read the explanation around them, and confirm the final price, availability and terms with the provider.',
          ],
        },
        {
          id: 'every-provider',
          q: 'Does Originfacts compare every airline and travel site?',
          a: [
            'No. Originfacts may not compare every provider or every travel option on the market, and we may receive commission from some providers and not others. Use what you find here as a starting point, not as the whole market.',
          ],
        },
        {
          id: 'go-links',
          q: 'Why do some links go through originfacts.com/go?',
          a: [
            "Links to some partner sites, such as CheapOair and Qatar Airways, pass through a short Originfacts redirect that adds our Takeads affiliate tracking before sending you to the partner's page. It only forwards to a fixed list of partner websites, and if tracking is unavailable you still reach the partner's page.",
          ],
        },
        {
          id: 'endorsement',
          q: 'Does a link mean Originfacts endorses that provider?',
          a: [
            'No. A link to a third-party website does not mean we guarantee or endorse that provider, or accept responsibility for its product, price, availability, safety, quality or terms.',
          ],
        },
      ],
    },
    {
      id: 'corrections-contact',
      title: 'Corrections & contact',
      intro: 'How to reach us, and where each kind of request should go.',
      items: [
        {
          id: 'report-an-error',
          q: 'How do I report an error or suggest a correction?',
          a: [
            'Email ',
            mail(CONTACT_EMAIL),
            ' or use the ',
            { text: 'contact form', href: '/contact' },
            '. Include the page URL, the exact text that looks wrong and a source we can verify. When something is wrong, it is corrected or removed.',
          ],
        },
        {
          id: 'how-to-contact',
          q: 'How do I contact Originfacts?',
          a: [
            'Use the ',
            { text: 'contact form', href: '/contact' },
            ' — pick a subject such as general support, website issue, affiliate enquiry, privacy request or accessibility feedback — or email ',
            mail(CONTACT_EMAIL),
            '. Our postal address is FXN Holdings, PO Box 500, WEST PERTH WA 6872, Australia.',
          ],
        },
        {
          id: 'legal-notice',
          q: 'Where do I send a legal notice or content complaint?',
          a: [
            'Email ',
            mail(SUPPORT_EMAIL),
            ' with your name and contact details, the URL of the content, a clear description of the issue, any supporting evidence and the action you are asking for. This covers legal notices, copyright complaints, illegal-content reports, fake-review reports and complaints about misleading information. See our ',
            { text: 'Legal Notice', href: '/legal/contact' },
            '.',
          ],
        },
        {
          id: 'affiliate-enquiries',
          q: 'How do I ask about affiliate or advertising partnerships?',
          a: [
            'Choose “Affiliate enquiry” on the ',
            { text: 'contact form', href: '/contact' },
            '. Questions about affiliate links or commercial relationships can also go to ',
            mail(SUPPORT_EMAIL),
            '.',
          ],
        },
        {
          id: 'accessibility',
          q: 'How do I report an accessibility problem?',
          a: [
            'Email ',
            mail(SUPPORT_EMAIL, 'Accessibility Feedback'),
            ' with the subject line “Accessibility Feedback”, the page URL, what you were trying to do and the device, browser or assistive technology you used. You can also ask for information in a different format. We are working toward WCAG 2.2 Level AA, but the site has not yet been independently audited — our ',
            { text: 'Accessibility statement', href: '/legal/accessibility' },
            ' lists known limitations.',
          ],
        },
        {
          id: 'social',
          q: 'Where can I follow Originfacts?',
          a: [
            'Links to our X, Facebook, LinkedIn, Instagram and Reddit accounts are on the ',
            { text: 'contact page', href: '/contact' },
            ' and in the site footer. You can also subscribe to the ',
            { text: 'RSS feed', href: '/feed.xml' },
            '.',
          ],
        },
      ],
    },
    {
      id: 'privacy-cookies',
      title: 'Privacy & cookies',
      intro: 'What data the site uses, and how to control it.',
      items: [
        {
          id: 'what-data',
          q: 'What personal information does Originfacts collect?',
          a: [
            'Information you give us, such as your name, email address and message when you contact us, and information collected automatically, such as your IP address, device and browser type, approximate location, pages viewed, links clicked, and cookie and affiliate click identifiers. The ',
            { text: 'Privacy Policy', href: '/legal/privacy' },
            ' explains how each is used.',
          ],
        },
        {
          id: 'payment-details',
          q: 'Does Originfacts store my payment details?',
          a: [
            "No. We don't take payments for bookings, and we don't ask for payment card details, passport numbers or national identity numbers. Payment happens on the provider's website, under its own terms and privacy policy.",
          ],
        },
        {
          id: 'sell-data',
          q: 'Does Originfacts sell my personal data?',
          a: [
            "We do not sell personal information for money. Some privacy laws treat certain analytics, affiliate or advertising technologies as “sharing” or “targeted advertising”; where that applies, the opt-out choices are explained in our ",
            { text: 'Privacy Policy', href: '/legal/privacy' },
            '.',
          ],
        },
        {
          id: 'cookie-choices',
          q: 'How do I change my cookie choices?',
          a: [
            'On your first visit, the cookie banner lets you accept all, reject all or choose categories (essential, analytics and advertising). You can reopen ',
            { text: 'Cookie settings', action: 'cookie-settings' },
            ' at any time to change your choice. The ',
            { text: 'Cookie Policy', href: '/legal/cookies' },
            ' describes the cookies and similar technologies used.',
          ],
        },
        {
          id: 'privacy-request',
          q: 'How do I make a privacy request?',
          a: [
            'Email ',
            mail(SUPPORT_EMAIL, 'Privacy Request'),
            ' with the subject line “Privacy Request”. Depending on where you live, you may have rights to access, correct or delete your information, object to or restrict processing, or withdraw consent. We may need to verify your identity before responding.',
          ],
        },
        {
          id: 'third-party-sites',
          q: 'What happens to my data when I click through to a partner site?',
          a: [
            'The booking site, airline or other provider you visit may collect and use your information under its own privacy policy and set its own cookies. Affiliate networks such as Travelpayouts may record the click so that a commission can be attributed.',
          ],
        },
      ],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}

/** Answer as plain text — what the schema says, and what search matches against. */
export function faqAnswerText(a: FaqSegment[]): string {
  return a
    .map((s) => (typeof s === 'string' ? s : s.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Flattens the groups into the Faq[] shape faqJsonLd() expects. */
export function faqsForSchema(groups: FaqGroup[]): Faq[] {
  return groups.flatMap((g) => g.items.map((i) => ({ q: i.q, a: faqAnswerText(i.a) })));
}
