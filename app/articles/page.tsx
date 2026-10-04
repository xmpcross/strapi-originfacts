import { permanentRedirect } from 'next/navigation';

type Props = { searchParams: Promise<{ page?: string }> };

export default async function ArticlesIndexRedirect({ searchParams }: Props) {
  const page = (await searchParams).page;
  permanentRedirect(page ? `/all-articles?page=${encodeURIComponent(page)}` : '/all-articles');
}
