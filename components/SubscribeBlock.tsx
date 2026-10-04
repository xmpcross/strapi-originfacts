export default function SubscribeBlock() {
  return (
    <section className="py-14" data-testid="home-subscribe">
      <div className="mx-auto max-w-7xl px-6">
        <div
          className="fn__subscribe_block relative z-0 flex flex-col items-stretch gap-[50px] overflow-hidden rounded-[5px] bg-[#f5f5f5] px-10 py-14 shadow-[0_1px_3px_rgba(0,0,0,0.15)] sm:flex-row sm:items-center"
        >
          {/* Decorative paperplane — pale gray, behind content */}
          <span
            aria-hidden
            className="sb_icon pointer-events-none absolute -right-[10px] -top-[10px] -z-10 block text-[#e5e5e5]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-60 w-60"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </span>

          <div className="sb_left relative z-10 max-w-[500px] flex-1">
            <h3
              className="!font-bold !text-[#080808]"
              style={{ fontSize: '30px', lineHeight: 1.2, fontWeight: 700 }}
            >
              Stay Informed With the Latest &amp; Most Important News
            </h3>
          </div>

          <div className="sb_right relative z-10 max-w-[500px] flex-1">
            <form
              id="mc4wp-form-1"
              className="mc4wp-form mc4wp-form-314"
              method="post"
              action="/api/subscribe"
              data-id="314"
              data-name="Newspaper"
              data-testid="home-subscribe-form"
            >
              <div className="mc4wp-form-fields">
                <div className="subscribe_holder flex items-center justify-between gap-[10px] border-b border-black">
                  <label htmlFor="home-subscribe-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="home-subscribe-email"
                    type="email"
                    name="EMAIL"
                    placeholder="Your email address"
                    required
                    className="h-11 min-w-0 flex-auto border-0 bg-transparent p-0 text-sm text-[#080808] placeholder:text-[#333] focus:outline-none focus:ring-0"
                  />
                  <input
                    type="submit"
                    value="Subscribe"
                    className="h-[30px] cursor-pointer rounded-[15px] border-0 bg-[#080808] px-[18px] pt-[2px] font-urbanist text-sm font-bold uppercase tracking-wider text-white outline-none transition hover:bg-primary-emphasis"
                  />
                </div>
                <p
                  className="agree mt-3 block text-[#080808]"
                  style={{ fontSize: '14px', lineHeight: '17px' }}
                >
                  <span>
                    I consent to receive newsletter via email. For further information, please review our{' '}
                    <a
                      href="/legal/privacy"
                      className="font-medium text-[#080808] no-underline"
                      style={{ borderBottom: '1px solid #777' }}
                    >
                      Privacy Policy
                    </a>
                  </span>
                </p>
              </div>
              <label style={{ display: 'none' }}>
                Leave this field empty if you&rsquo;re human:{' '}
                <input
                  type="text"
                  name="_mc4wp_honeypot"
                  defaultValue=""
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
              <input type="hidden" name="_mc4wp_form_id" value="314" />
              <input type="hidden" name="_mc4wp_form_element_id" value="mc4wp-form-1" />
              <div className="mc4wp-response" />
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
