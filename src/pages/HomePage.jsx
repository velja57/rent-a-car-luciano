import FleetTeaser from '../components/FleetTeaser';
import Hero from '../components/Hero';
import WhyUs from '../components/WhyUs';
import { usePageMeta } from '../lib/usePageMeta';

export default function HomePage() {
  // Isto kao u index.html — vraća se kad korisnik dođe sa druge stranice.
  usePageMeta(
    'Luciano Rent a Car',
    'Luciano Rent a Car — iznajmljivanje vozila novije generacije. Rezerviši svoje vozilo za nekoliko klikova.',
  );

  return (
    <>
      <Hero />
      <FleetTeaser />
      <WhyUs />
    </>
  );
}
