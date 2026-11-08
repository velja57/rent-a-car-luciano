import { useState } from 'react';
import { cars } from '../hero.config';
import CarStage from './CarStage';
import CarSelectForm from './CarSelectForm';

const playableCars = cars.filter((c) => !c.comingSoon);

export default function Hero() {
  const [selectedId, setSelectedId] = useState(playableCars[0].id);
  const [phase, setPhase] = useState('idle');
  const selectedCar = cars.find((c) => c.id === selectedId);

  return (
    <section className="hero" id="vozila">
      <div className="hero__stage">
        <CarStage car={selectedCar} cars={playableCars} onPhaseChange={setPhase} />
        <div className="hero__scrim" />
      </div>

      <div className="hero__content container">
        <CarSelectForm
          cars={cars}
          selectedId={selectedId}
          onChange={setSelectedId}
          isTransitioning={phase !== 'idle'}
        />
      </div>
    </section>
  );
}
