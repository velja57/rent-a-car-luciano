import { Route, Routes } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollManager from './components/ScrollManager';
import HomePage from './pages/HomePage';
import FleetPage from './pages/FleetPage';
import VehiclePage from './pages/VehiclePage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

export default function App() {
  return (
    <div id="top">
      <ScrollManager />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/vozila" element={<FleetPage />} />
          <Route path="/vozila/:id" element={<VehiclePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
