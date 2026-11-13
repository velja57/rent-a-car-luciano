import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

// Minimalni horizontalni pomeraj prsta (px) da bi se prevuklo na sledeću sliku.
const SWIPE_THRESHOLD_PX = 40;

function pad(n) {
  return String(n).padStart(2, '0');
}

export default function VehicleGallery({ car }) {
  const { t } = useI18n();
  const touchStartX = useRef(null);
  const [active, setActive] = useState(0);
  const count = car.images.length;
  const image = car.images[active];
  const altFor = (img) => `${car.name} — ${t.views[img.view]}`;

  const step = (dir) => setActive((i) => (i + dir + count) % count);

  // Učitaj sve velike slike odmah, da prelazak u galeriji bude bez čekanja.
  useEffect(() => {
    car.images.forEach(({ src }) => {
      const img = new Image();
      img.src = src;
    });
  }, [car]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) step(dx < 0 ? 1 : -1);
  };

  return (
    <div className="vehicle-gallery">
      <div
        className="vehicle-gallery__stage"
        tabIndex={0}
        role="group"
        aria-roledescription={t.gallery.roleDescription}
        aria-label={t.gallery.label(car.name)}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img className="vehicle-gallery__backdrop" src={image.thumb} alt="" aria-hidden="true" />
        <img key={image.src} className="vehicle-gallery__image" src={image.src} alt={altFor(image)} />
        {count > 1 && (
          <>
            <button
              type="button"
              className="vehicle-gallery__nav vehicle-gallery__nav--prev"
              aria-label={t.gallery.prev}
              onClick={() => step(-1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className="vehicle-gallery__nav vehicle-gallery__nav--next"
              aria-label={t.gallery.next}
              onClick={() => step(1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
        <span className="vehicle-gallery__counter" aria-live="polite">
          {pad(active + 1)} / {pad(count)}
        </span>
      </div>

      <div className="vehicle-gallery__thumbs">
        {car.images.map((img, i) => (
          <button
            type="button"
            key={img.src}
            className={`vehicle-gallery__thumb${i === active ? ' vehicle-gallery__thumb--active' : ''}`}
            aria-label={t.gallery.thumb(i + 1, altFor(img))}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => setActive(i)}
          >
            <img src={img.thumb} alt="" style={{ objectPosition: img.focus }} />
          </button>
        ))}
      </div>
    </div>
  );
}
