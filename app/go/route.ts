import { NextResponse, type NextRequest } from 'next/server';
import { addTrackingParameters, resolveTakeadsLink } from '@/lib/takeads';
import { isTakeadsMerchant } from '@/lib/partner-links';

/**
 * Outbound partner redirect: /go?url=<merchant page>&s=<sub id>
 *
 * Resolves the merchant URL to a Takeads tracking link (server-side, cached a
 * day per URL) and redirects to it. Only Takeads merchant domains are accepted
 * (see TAKEADS_MERCHANT_DOMAINS), so this is not an open redirect. If Takeads
 * has no link — key missing, API down, merchant not approved — the visitor still
 * reaches the merchant page, just untracked.
 *
 * Disallowed in robots.ts; responses are noindex and never cached by the CDN.
 */
export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url') ?? '';
  const subId = request.nextUrl.searchParams.get('s') ?? 'originfacts';

  if (!isTakeadsMerchant(target)) {
    return NextResponse.json({ error: 'Unknown partner link.' }, { status: 400 });
  }

  const tracking = await resolveTakeadsLink(target);
  const destination = tracking ? addTrackingParameters(tracking, subId) : target;

  const response = NextResponse.redirect(destination, 302);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
