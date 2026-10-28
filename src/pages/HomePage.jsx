import AirportSection from '../components/AirportSection';
import FleetTeaser from '../components/FleetTeaser';
import Hero from '../components/Hero';
import Reviews from '../components/Reviews';
import WhyUs from '../components/WhyUs';
import { useI18n } from '../i18n';
import { usePageMeta } from '../lib/usePageMeta';

export default function HomePage() {
  const { t } = useI18n();
  // Srpski naslov i opis su isti kao u index.html.
  usePageMeta(t.meta.homeTitle, t.meta.homeDescription);

  return (
    <>
      <Hero />
      <FleetTeaser />
      <AirportSection />
      <Reviews />
      <WhyUs />
    </>
  );
}
