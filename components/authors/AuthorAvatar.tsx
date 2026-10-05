import Image from 'next/image';
import type { AuthorProfile } from '@/lib/authors';
import { hasPhoto, initials } from '@/lib/author-directory';

/**
 * The author's CMS photo, or an initials disc when the CMS has none. Never the
 * generic placeholder: a stand-in face next to a named editor reads as a real one.
 */
export default function AuthorAvatar({
  author,
  size,
  className = '',
  priority = false,
}: {
  author: AuthorProfile;
  size: number;
  className?: string;
  priority?: boolean;
}) {
  if (hasPhoto(author)) {
    return (
      <span
        className={`relative block shrink-0 overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={author.avatar}
          alt={`Photo of ${author.name}`}
          width={size}
          height={size}
          priority={priority}
          className="h-full w-full !rounded-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={`${author.name} (no photo)`}
      className={`flex shrink-0 items-center justify-center rounded-full bg-forest-950 font-bold tracking-wide text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      data-testid="author-initials"
    >
      {initials(author.name)}
    </span>
  );
}
