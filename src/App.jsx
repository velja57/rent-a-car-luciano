import { Route, Routes } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollManager from './components/ScrollManager';
import I18nProvider from './i18n/I18nProvider';
import { usePriceList } from './lib/priceList';
import HomePage from './pages/HomePage';
import FleetPage from './pages/FleetPage';
import VehiclePage from './pages/VehiclePage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

// Iste stranice na srpskom (/, /vozila) i engleskom (/en, /en/vehicles) — vidi src/i18n/routes.js.
export default function App() {
  // Cene iz baze (cenovnik iz admin panela) — kad stignu, sajt se ponovo iscrta.
  usePriceList();

  return (
    <I18nProvider>
      <div id="top">
        <ScrollManager />
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/vozila" element={<FleetPage />} />
            <Route path="/vozila/:id" element={<VehiclePage />} />
            <Route path="/en" element={<HomePage />} />
            <Route path="/en/vehicles" element={<FleetPage />} />
            <Route path="/en/vehicles/:id" element={<VehiclePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}
