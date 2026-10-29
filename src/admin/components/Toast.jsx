import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Kratke poruke posle akcije ("Rezervacija je sačuvana") u donjem desnom uglu.
const ToastContext = createContext(null);

const DURATION_MS = 4500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type, message) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, type, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({ success: (message) => show('success', message), error: (message) => show('error', message) }),
    [show],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="admin-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`admin-toast admin-toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            <button type="button" className="admin-toast__close" aria-label="Zatvori" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
