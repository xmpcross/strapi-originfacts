import {
  Armchair,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarX2,
  CircleHelp,
  ClockCheck,
  Globe,
  Headset,
  Luggage,
  Plane,
  Ruler,
  ScanLine,
  Smartphone,
  Ticket,
  Weight,
  type LucideIcon,
} from 'lucide-react';

/** One icon per page section, shared by the nav, the section headers and the sources list. */
export const SECTION_ICONS: Record<string, LucideIcon> = {
  carryon: BriefcaseBusiness,
  baggage: Luggage,
  fares: Ticket,
  cabins: Armchair,
  rights: CalendarX2,
  checkin: ClockCheck,
  contact: Headset,
  network: Globe,
  faq: CircleHelp,
  sources: BadgeCheck,
};

/** At-a-glance tile icons, keyed by GLANCE_TILES id. */
export const GLANCE_ICONS: Record<string, LucideIcon> = {
  'carryon-size': Ruler,
  'carryon-weight': Weight,
  checked: Luggage,
  'online-checkin': Smartphone,
  'checkin-closes': ScanLine,
  phone: Headset,
};

export const FALLBACK_ICON: LucideIcon = Plane;
