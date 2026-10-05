// Pages where the fixed left/right side rails (FixedPopularNow, FixedRightBar)
// are hidden. Destination detail pages hide them to give the hero + facts panel
// + airports/airlines filters more horizontal room; the rest are listing,
// directory and editorial/legal pages the owner wanted kept clean.
const HIDE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/destinations(\/[^/]+)?$/,
  /^\/category\/[^/]+$/,
  /^\/airports\/top-100-airports$/,
  /^\/flight-search$/,
  /^\/methodology$/,
  /^\/authors(\/[^/]+)?$/,
  /^\/about$/,
  /^\/contact$/,
  /^\/faq$/,
  /^\/legal(\/[^/]+)?$/,
];

export function sideRailsHidden(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return HIDE_PATTERNS.some((re) => re.test(path));
}
