import Header from './components/Header';
import Hero from './components/Hero';
import WhyUs from './components/WhyUs';
import Footer from './components/Footer';
import './App.css';

export default function App() {
  return (
    <div id="top">
      <Header />
      <main>
        <Hero />
        <WhyUs />
      </main>
      <Footer />
    </div>
  );
}
