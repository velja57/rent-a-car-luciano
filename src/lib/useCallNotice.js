import { useState } from 'react';

// Na računaru (bez dodirnog ekrana) klik na "tel:" link obično ne radi ništa
// vidljivo (ili browser/OS samo pita kojom aplikacijom da ga otvori) — zato na
// takvim uređajima umesto poziva prikazujemo poruku sa mejlom i brojem.
export function useCallNotice() {
  const [showCallNotice, setShowCallNotice] = useState(false);

  const handleCallClick = (e) => {
    const isTouchDevice =
      typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!isTouchDevice) {
      e.preventDefault();
      setShowCallNotice(true);
    }
  };

  // Zatvara poruku kad pokazivač napusti dugme/poruku — spoji na onMouseLeave
  // omotača koji sadrži i dugme i <CallNotice />.
  const handleMouseLeave = () => setShowCallNotice(false);

  return { showCallNotice, handleCallClick, handleMouseLeave };
}
