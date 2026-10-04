import Link from 'next/link';
import Image from 'next/image';
import { AuthorProfile } from '@/lib/authors';

interface AuthorCardProps {
  author: AuthorProfile;
  compact?: boolean;
}

export default function AuthorCard({ author, compact = false }: AuthorCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm text-forest-900/80" data-testid="author-byline">
        <Link href={`/authors/${author.slug}`} className="group flex items-center gap-3">
          <Image
            src={author.avatar}
            alt={author.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover border border-forest-900/10"
          />
          <div>
            <span className="text-xs uppercase tracking-wider text-forest-800/60 block">Written by</span>
            <strong className="font-semibold text-forest-900 group-hover:text-primary-emphasis transition">
              {author.name}
            </strong>
            <span className="text-xs text-forest-900/60 ml-2">({author.jobTitle})</span>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="my-10 rounded-xl border border-forest-900/10 bg-forest-50/50 p-6 sm:p-8"
      data-testid="author-card"
      itemScope
      itemType="https://schema.org/Person"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Link href={`/authors/${author.slug}`} className="shrink-0">
          <Image
            src={author.avatar}
            alt={author.name}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-sm transition hover:scale-105"
            itemProp="image"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary-emphasis">
                Author &amp; Editorial Reviewer
              </p>
              <h3 className="editorial-h text-xl font-bold text-forest-950 mt-1">
                <Link href={`/authors/${author.slug}`} itemProp="name" className="hover:text-primary-emphasis">
                  {author.name}
                </Link>
              </h3>
              <p className="text-xs font-medium text-forest-900/70" itemProp="jobTitle">
                {author.jobTitle}
              </p>
            </div>
            <Link
              href={`/authors/${author.slug}`}
              className="rounded-md border border-forest-900/15 bg-white px-3 py-1.5 text-xs font-semibold text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
            >
              View Full Profile &rarr;
            </Link>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-forest-900/80" itemProp="description">
            {author.bio}
          </p>

          {author.expertise && author.expertise.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-forest-900/60 mr-1">
                Expertise:
              </span>
              {author.expertise.map((exp) => (
                <span
                  key={exp}
                  className="rounded bg-white px-2 py-0.5 text-xs font-medium text-forest-900/75 border border-forest-900/10"
                >
                  {exp}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-forest-900/10 pt-4 text-xs">
            <div className="flex items-center gap-4 text-forest-900/70">
              {author.email && (
                <a href={`mailto:${author.email}`} className="hover:text-forest-950 underline">
                  {author.email}
                </a>
              )}
              {author.socials?.x && (
                <a
                  href={author.socials.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-emphasis"
                >
                  X / Twitter
                </a>
              )}
              {author.socials?.linkedin && (
                <a
                  href={author.socials.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-emphasis"
                >
                  LinkedIn
                </a>
              )}
            </div>
            <Link href="/methodology" className="text-forest-900/60 hover:text-forest-900 underline">
              Editorial Standards &amp; Methodology
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
