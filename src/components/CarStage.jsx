import { useCallback, useEffect, useRef, useState } from 'react';

// Frejmovi su izvučeni na 12fps (vidi README_HERO.md za regenerisanje).
const FRAME_INTERVAL_MS = 1000 / 12;

function frameUrl(car, index) {
  return `${car.framesDir}/${String(index).padStart(4, '0')}.jpg`;
}

function loadCarFrames(car) {
  const urls = Array.from({ length: car.frameCount }, (_, i) => frameUrl(car, i));
  return Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Ne mogu da učitam frejm: ${src}`));
          img.src = src;
        }),
    ),
  );
}

/**
 * Prikazuje izabrani auto kao sekvencu slika na canvas-u.
 * - idle: statičan prvi frejm (auto parkiran)
 * - promena auta: trenutni auto "odlazi" (frejmovi napred do kraja),
 *   pa novi auto "dolazi" (frejmovi unazad do pozicije 0 = parkirano)
 * Igranje unapred/unazad kroz isti frejm-set garantuje da se svaka
 * sekvenca uvek vrati tačno na parkiranu pozu (frame 0).
 */
export default function CarStage({ car, cars, onPhaseChange }) {
  const canvasRef = useRef(null);
  const cacheRef = useRef(new Map());
  const [ready, setReady] = useState(false);
  const state = useRef({
    phase: 'idle',
    shownCarId: car.id,
    targetCarId: car.id,
    frameIndex: 0,
    rafId: null,
    lastTs: 0,
  }).current;

  const draw = useCallback((carId, frameIndex) => {
    const canvas = canvasRef.current;
    const images = cacheRef.current.get(carId);
    const img = images?.[frameIndex];
    if (!canvas || !img) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let dw, dh, dx, dy;
    if (imgRatio > boxRatio) {
      dh = h;
      dw = h * imgRatio;
      dx = (w - dw) / 2;
      dy = 0;
    } else {
      dw = w;
      dh = w / imgRatio;
      dx = 0;
      dy = (h - dh) / 2;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, dw, dh);
  }, []);

  const ensureLoaded = useCallback((carObj) => {
    if (cacheRef.current.has(carObj.id)) return Promise.resolve(cacheRef.current.get(carObj.id));
    return loadCarFrames(carObj).then((images) => {
      cacheRef.current.set(carObj.id, images);
      return images;
    });
  }, []);

  const stopAnim = useCallback(() => {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }, [state]);

  const runSequence = useCallback(
    (carId, direction, onDone) => {
      const images = cacheRef.current.get(carId);
      const total = images.length;
      state.frameIndex = direction === 'forward' ? 0 : total - 1;
      state.lastTs = 0;
      stopAnim();

      const step = (ts) => {
        if (!state.lastTs) state.lastTs = ts;
        const elapsed = ts - state.lastTs;
        if (elapsed >= FRAME_INTERVAL_MS) {
          state.lastTs = ts;
          draw(carId, state.frameIndex);
          const atEnd = direction === 'forward' ? state.frameIndex >= total - 1 : state.frameIndex <= 0;
          if (atEnd) {
            state.rafId = null;
            onDone();
            return;
          }
          state.frameIndex += direction === 'forward' ? 1 : -1;
        }
        state.rafId = requestAnimationFrame(step);
      };
      state.rafId = requestAnimationFrame(step);
    },
    [draw, state, stopAnim],
  );

  const startArrival = useCallback(() => {
    const incomingCarId = state.targetCarId;
    state.phase = 'arriving';
    onPhaseChange?.('arriving');
    const incomingCar = cars.find((c) => c.id === incomingCarId);
    ensureLoaded(incomingCar).then(() => {
      runSequence(incomingCarId, 'backward', () => {
        state.shownCarId = incomingCarId;
        state.phase = 'idle';
        onPhaseChange?.('idle');
        if (state.targetCarId !== state.shownCarId) {
          startDeparture(state.shownCarId);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars, ensureLoaded, runSequence, state, onPhaseChange]);

  const startDeparture = useCallback(
    (outgoingCarId) => {
      state.phase = 'departing';
      onPhaseChange?.('departing');
      const outgoingCar = cars.find((c) => c.id === outgoingCarId);
      ensureLoaded(outgoingCar).then(() => {
        runSequence(outgoingCarId, 'forward', () => startArrival());
      });
    },
    [cars, ensureLoaded, runSequence, startArrival, state, onPhaseChange],
  );

  // inicijalno učitavanje: nacrtaj prvi auto parkiran, pa učitaj ostale u pozadini
  useEffect(() => {
    let cancelled = false;
    ensureLoaded(car).then(() => {
      if (cancelled) return;
      draw(car.id, 0);
      setReady(true);
      cars.filter((c) => c.id !== car.id).forEach((c) => ensureLoaded(c));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reaguj na promenu izbora iz dropdowna
  useEffect(() => {
    state.targetCarId = car.id;
    if (state.phase === 'idle' && state.shownCarId !== car.id) {
      startDeparture(state.shownCarId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.id]);

  // redraw na resize (da ostane "cover" bez distorzije)
  useEffect(() => {
    const onResize = () => draw(state.shownCarId, state.frameIndex);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw, state]);

  useEffect(() => stopAnim, [stopAnim]);

  return (
    <div className="car-stage">
      <canvas
        ref={canvasRef}
        className={`car-stage__canvas${ready ? ' car-stage__canvas--ready' : ''}`}
        aria-label="Prikaz izabranog vozila na ulici"
      />
      {!ready && (
        <div className="car-stage__skeleton">
          <div className="car-stage__skeleton-shine" />
        </div>
      )}
    </div>
  );
}
