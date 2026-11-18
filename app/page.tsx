import { loadLogos } from '@/lib/logos';
import { loadBadges } from '@/lib/badges';
import Gallery from './gallery';

export default function Home() {
  const logos = loadLogos();
  const { badges, notFound } = loadBadges();
  return <Gallery logos={logos} badges={badges} badgeGaps={notFound} />;
}
