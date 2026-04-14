import { loadLogos } from '@/lib/logos';
import Gallery from './gallery';

export default function Home() {
  const logos = loadLogos();
  return <Gallery logos={logos} />;
}
