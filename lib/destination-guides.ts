/**
 * Written city guides, kept in the repo while the new city layout is piloted
 * on a few pages. A city with a guide here renders CityGuidePage instead of
 * the default template, and the guide's fields take the place of the CMS
 * ones. Drafts come from ops/generate-destination-guides.mjs and are reviewed
 * before they are added.
 */
import type { StrapiDestination } from '@/lib/strapi';
import adelaide from '@/data/destination-guides/adelaide.json';
import amsterdam from '@/data/destination-guides/amsterdam.json';
import athens from '@/data/destination-guides/athens.json';
import bangkok from '@/data/destination-guides/bangkok.json';
import barcelona from '@/data/destination-guides/barcelona.json';
import beijing from '@/data/destination-guides/beijing.json';
import brisbane from '@/data/destination-guides/brisbane.json';
import chania from '@/data/destination-guides/chania.json';
import chengdu from '@/data/destination-guides/chengdu.json';
import chennai from '@/data/destination-guides/chennai.json';
import chiangMai from '@/data/destination-guides/chiang-mai.json';
import chicago from '@/data/destination-guides/chicago.json';
import dallas from '@/data/destination-guides/dallas.json';
import darwin from '@/data/destination-guides/darwin.json';
import denpasar from '@/data/destination-guides/denpasar.json';
import fukuoka from '@/data/destination-guides/fukuoka.json';
import gothenburg from '@/data/destination-guides/gothenburg.json';
import guangzhou from '@/data/destination-guides/guangzhou.json';
import hamburg from '@/data/destination-guides/hamburg.json';
import heraklion from '@/data/destination-guides/heraklion.json';
import hiroshima from '@/data/destination-guides/hiroshima.json';
import hoChiMinhCity from '@/data/destination-guides/ho-chi-minh-city.json';
import houston from '@/data/destination-guides/houston.json';
import interlaken from '@/data/destination-guides/interlaken.json';
import istanbul from '@/data/destination-guides/istanbul.json';
import jakarta from '@/data/destination-guides/jakarta.json';
import kiruna from '@/data/destination-guides/kiruna.json';
import krabi from '@/data/destination-guides/krabi.json';
import kuressaare from '@/data/destination-guides/kuressaare.json';
import kyoto from '@/data/destination-guides/kyoto.json';
import london from '@/data/destination-guides/london.json';
import losAngeles from '@/data/destination-guides/los-angeles.json';
import luangPrabang from '@/data/destination-guides/luang-prabang.json';
import melbourne from '@/data/destination-guides/melbourne.json';
import mumbai from '@/data/destination-guides/mumbai.json';
import munich from '@/data/destination-guides/munich.json';
import nagoya from '@/data/destination-guides/nagoya.json';
import newYork from '@/data/destination-guides/new-york.json';
import okinawa from '@/data/destination-guides/okinawa.json';
import osaka from '@/data/destination-guides/osaka.json';
import paris from '@/data/destination-guides/paris.json';
import pattaya from '@/data/destination-guides/pattaya.json';
import perth from '@/data/destination-guides/perth.json';
import phraNakhonSiAyutthaya from '@/data/destination-guides/phra-nakhon-si-ayutthaya.json';
import phuket from '@/data/destination-guides/phuket.json';
import prague from '@/data/destination-guides/prague.json';
import puertoPrincesa from '@/data/destination-guides/puerto-princesa.json';
import rhodesTown from '@/data/destination-guides/rhodes-town.json';
import rome from '@/data/destination-guides/rome.json';
import sanFrancisco from '@/data/destination-guides/san-francisco.json';
import sapporo from '@/data/destination-guides/sapporo.json';
import shenzhen from '@/data/destination-guides/shenzhen.json';
import sydney from '@/data/destination-guides/sydney.json';
import tasmania from '@/data/destination-guides/tasmania.json';
import vienna from '@/data/destination-guides/vienna.json';

export type GuideSource = { url: string; title: string };

export type DestinationGuide = {
  /** Markdown: an intro paragraph, then `## ` sections. */
  description: string;
  tldr: string;
  keyFacts: { label: string; value: string }[];
  faqs: { q: string; a: string }[];
  sources: GuideSource[];
};

const GUIDES: Record<string, DestinationGuide> = { adelaide, amsterdam, athens, bangkok, barcelona, beijing, brisbane, chania, chengdu, chennai, 'chiang-mai': chiangMai, chicago, dallas, darwin, denpasar, fukuoka, gothenburg, guangzhou, hamburg, heraklion, hiroshima, 'ho-chi-minh-city': hoChiMinhCity, houston, interlaken, istanbul, jakarta, kiruna, krabi, kuressaare, kyoto, london, 'los-angeles': losAngeles, 'luang-prabang': luangPrabang, melbourne, mumbai, munich, nagoya, 'new-york': newYork, okinawa, osaka, paris, pattaya, perth, 'phra-nakhon-si-ayutthaya': phraNakhonSiAyutthaya, phuket, prague, 'puerto-princesa': puertoPrincesa, 'rhodes-town': rhodesTown, rome, 'san-francisco': sanFrancisco, sapporo, shenzhen, sydney, tasmania, vienna };

export function getDestinationGuide(slug: string): DestinationGuide | null {
  return GUIDES[slug] ?? null;
}

/** The destination with the guide's written fields in place of the CMS ones. */
export function withGuide(destination: StrapiDestination, guide: DestinationGuide | null): StrapiDestination {
  if (!guide) return destination;
  return {
    ...destination,
    description: guide.description,
    tldr: guide.tldr,
    keyFacts: guide.keyFacts,
    faqs: guide.faqs,
  };
}
