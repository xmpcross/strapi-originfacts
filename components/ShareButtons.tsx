'use client';

import { useEffect, useState } from 'react';

type Props = {
  title: string;
  slug: string;
};

const SITE_URL = 'https://www.originfacts.com';

export default function ShareButtons({ title, slug }: Props) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`${SITE_URL}/articles/${slug}`);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(window.location.href);
    }
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const xHref = `https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&via=realoriginfacts`;
  const pinterestHref = `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`;
  const vkHref = `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const iconBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-forest-950 transition hover:text-primary-emphasis';

  return (
    <div
      className="inline-flex items-center rounded-full bg-[#f1f5f9] py-1 pl-4 pr-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      data-testid="share-buttons"
    >
      <span className="text-[12px] font-bold uppercase tracking-widest text-forest-950">
        Share
      </span>
      <span aria-hidden className="mx-3 h-5 w-px bg-forest-900/15" />
      <div className="flex items-center gap-1">
        <a
          href={facebookHref}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          aria-label="Share on Facebook"
          data-testid="share-facebook"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M22 12.06C22 6.48 17.52 2 11.94 2 6.36 2 1.88 6.48 1.88 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.78v-2.91h2.54V9.84c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46H15.1c-1.24 0-1.62.77-1.62 1.56v1.87h2.76l-.44 2.91h-2.32V22c4.78-.76 8.52-4.92 8.52-9.94z" />
          </svg>
        </a>
        <a
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          aria-label="Share on X"
          data-testid="share-x"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.677l7.73-8.835L1.255 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <a
          href={pinterestHref}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          aria-label="Share on Pinterest"
          data-testid="share-pinterest"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.084 2.45 7.594 5.957 9.131-.082-.776-.156-1.967.032-2.815.171-.766 1.103-4.873 1.103-4.873s-.281-.563-.281-1.394c0-1.305.756-2.279 1.698-2.279.8 0 1.187.601 1.187 1.322 0 .805-.513 2.009-.778 3.124-.221.933.469 1.694 1.39 1.694 1.668 0 2.951-1.759 2.951-4.299 0-2.247-1.614-3.818-3.917-3.818-2.669 0-4.237 2.002-4.237 4.072 0 .807.31 1.671.7 2.142a.282.282 0 0 1 .065.27c-.072.295-.232.933-.262 1.063-.041.171-.135.207-.31.124-1.158-.539-1.883-2.231-1.883-3.59 0-2.924 2.124-5.61 6.122-5.61 3.213 0 5.711 2.29 5.711 5.353 0 3.193-2.014 5.762-4.81 5.762-.94 0-1.823-.488-2.124-1.063l-.578 2.202c-.209.808-.775 1.822-1.153 2.439A10 10 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
          </svg>
        </a>
        <a
          href={vkHref}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          aria-label="Share on VK"
          data-testid="share-vk"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M12.785 16.241s.288-.032.435-.193c.135-.147.131-.422.131-.422s-.018-1.298.586-1.49c.595-.189 1.359 1.259 2.169 1.815.612.421 1.077.328 1.077.328l2.165-.03s1.132-.071.595-.961c-.044-.073-.313-.658-1.612-1.864-1.36-1.262-1.178-1.058.46-3.241.997-1.329 1.396-2.142 1.271-2.491-.118-.331-.852-.244-.852-.244l-2.435.015s-.181-.025-.315.056c-.131.079-.215.262-.215.262s-.385 1.029-.901 1.904c-1.084 1.846-1.518 1.943-1.696 1.83-.413-.266-.31-1.074-.31-1.648 0-1.793.272-2.541-.528-2.734-.265-.064-.46-.107-1.135-.114-.867-.009-1.601.003-2.017.207-.276.135-.49.437-.36.454.16.022.523.099.715.361.249.339.24 1.099.24 1.099s.142 2.092-.336 2.352c-.328.179-.778-.186-1.745-1.862-.495-.858-.869-1.806-.869-1.806s-.072-.176-.201-.27c-.156-.114-.374-.15-.374-.15l-2.314.015s-.347.01-.475.161c-.114.135-.009.413-.009.413s1.813 4.243 3.866 6.382c1.882 1.96 4.019 1.832 4.019 1.832h.97z" />
          </svg>
        </a>
        <button
          type="button"
          onClick={onCopy}
          className={iconBtn}
          aria-label={copied ? 'Link copied' : 'Copy link'}
          data-testid="share-copy"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
