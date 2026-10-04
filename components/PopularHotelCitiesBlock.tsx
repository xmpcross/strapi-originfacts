'use client';

import { useEffect, useMemo, useState } from 'react';

const BOOKING_AFFILIATE_URL = 'https://tatrck.com/h/0Hu30_OZ0V7N?model=cpc';

type GeoResponse = {
  name?: string;
  country?: string;
};

type HotelCityCard = {
  name: string;
  region?: string;
  image: string;
  wide?: boolean;
};

type CountryHotelCities = {
  label: string;
  flagCode: string;
  cities: HotelCityCard[];
};

const COUNTRY_CITY_SETS: Record<string, CountryHotelCities> = {
  australia: {
    label: 'Australia',
    flagCode: 'au',
    cities: [
      {
        name: 'Sydney',
        region: 'New South Wales',
        image: '/generated/hotel-cities/sydney.jpg',
        wide: true,
      },
      {
        name: 'Melbourne',
        region: 'Victoria',
        image: 'https://images.unsplash.com/photo-1514395462725-fb4566210144?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      { name: 'Brisbane', region: 'Queensland', image: '/generated/hotel-cities/brisbane.jpg' },
      {
        name: 'Gold Coast',
        region: 'Queensland',
        image: 'https://images.unsplash.com/photo-1540202404-a2f29016b523?auto=format&fit=crop&w=900&q=80',
      },
      { name: 'Perth', region: 'Western Australia', image: '/generated/hotel-cities/perth.jpg' },
    ],
  },
  'united-states': {
    label: 'United States',
    flagCode: 'us',
    cities: [
      {
        name: 'New York',
        region: 'New York',
        image: 'https://images.unsplash.com/photo-1538970272646-f61fabb3a8a2?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Los Angeles',
        region: 'California',
        image: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Chicago',
        region: 'Illinois',
        image: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?auto=format&fit=crop&w=900&q=80',
      },
      {
        name: 'Miami',
        region: 'Florida',
        image: 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?auto=format&fit=crop&w=900&q=80',
      },
      {
        name: 'Las Vegas',
        region: 'Nevada',
        image: 'https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?auto=format&fit=crop&w=900&q=80',
      },
    ],
  },
  'united-kingdom': {
    label: 'United Kingdom',
    flagCode: 'gb',
    cities: [
      {
        name: 'London',
        region: 'England',
        image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Edinburgh',
        region: 'Scotland',
        image: 'https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Manchester',
        region: 'England',
        image: '/generated/hotel-cities/manchester.jpg',
      },
      {
        name: 'Liverpool',
        region: 'England',
        image: '/generated/hotel-cities/liverpool.jpg',
      },
      {
        name: 'Bristol',
        region: 'England',
        image: 'https://images.unsplash.com/photo-1518877593221-1f28583780b4?auto=format&fit=crop&w=900&q=80',
      },
    ],
  },
  canada: {
    label: 'Canada',
    flagCode: 'ca',
    cities: [
      {
        name: 'Toronto',
        region: 'Ontario',
        image: 'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Vancouver',
        region: 'British Columbia',
        image: 'https://images.unsplash.com/photo-1559511260-66a654ae982a?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Montreal',
        region: 'Quebec',
        image: 'https://images.unsplash.com/photo-1519178614-68673b201f36?auto=format&fit=crop&w=900&q=80',
      },
      {
        name: 'Calgary',
        region: 'Alberta',
        image: 'https://images.unsplash.com/photo-1609607847926-da4702f01fef?auto=format&fit=crop&w=900&q=80',
      },
      {
        name: 'Quebec City',
        region: 'Quebec',
        image: 'https://images.unsplash.com/photo-1565544382-dfe51fd89536?auto=format&fit=crop&w=900&q=80',
      },
    ],
  },
  singapore: {
    label: 'Singapore',
    flagCode: 'sg',
    cities: [
      {
        name: 'Marina Bay',
        region: 'Singapore',
        image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Orchard',
        region: 'Singapore',
        image: 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=1200&q=80',
        wide: true,
      },
      {
        name: 'Sentosa',
        region: 'Singapore',
        image: 'https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=900&q=80',
      },
      {
        name: 'Chinatown',
        region: 'Singapore',
        image: 'https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=900&q=80',
      },
      {
        name: 'Little India',
        region: 'Singapore',
        image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=900&q=80',
      },
    ],
  },
};

const DEFAULT_COUNTRY_KEY = 'australia';

function countryKey(country?: string) {
  return (country || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function bookingDestinationUrl(city: HotelCityCard, countryLabel: string) {
  const destination = [city.name, city.region, countryLabel].filter(Boolean).join(', ');
  return `${BOOKING_AFFILIATE_URL}&url=${encodeURIComponent(
    `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`,
  )}`;
}

export default function PopularHotelCitiesBlock() {
  const [geo, setGeo] = useState<GeoResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadGeo() {
      try {
        const res = await fetch('/api/nearest-city', { cache: 'no-store' });
        const data = (await res.json()) as GeoResponse;
        if (active) setGeo(data);
      } catch {
        if (active) setGeo(null);
      }
    }

    loadGeo();
    return () => {
      active = false;
    };
  }, []);

  const citySet = useMemo(() => {
    return COUNTRY_CITY_SETS[countryKey(geo?.country)] ?? COUNTRY_CITY_SETS[DEFAULT_COUNTRY_KEY];
  }, [geo?.country]);

  return (
    <section className="mt-20" data-testid="popular-hotel-cities">
      <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
        Popular hotel cities in {citySet.label}
      </h2>
      <p className="mt-2 max-w-4xl text-[1rem] text-ink/75">
        Compare hotel areas in popular arrival cities before you choose flights. These shortcuts open hotel options through our Booking.com partner link.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-6">
        {citySet.cities.map((city) => (
          <a
            key={city.name}
            href={bookingDestinationUrl(city, citySet.label)}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className={`group relative h-[267px] overflow-hidden rounded-[0.4rem] bg-forest-950 ${
              city.wide ? 'md:col-span-3' : 'md:col-span-2'
            }`}
            aria-label={`Search hotels in ${city.name} on Booking.com`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={city.image}
              alt={`${city.name} hotels`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-forest-950/82 via-forest-950/18 to-transparent" />
            <div className="absolute left-4 top-4 flex items-center gap-2 text-white sm:left-5 sm:top-5">
              <h5
                className="font-urbanist leading-none text-white drop-shadow-sm"
                style={{ color: '#ffffff', fontSize: '1.3rem', fontWeight: '600' }}
              >
                {city.name}
              </h5>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/${citySet.flagCode}.svg`}
                alt={`${citySet.label} flag`}
                loading="lazy"
                className="h-6 w-8 rounded-[2px] object-cover drop-shadow-sm"
              />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
