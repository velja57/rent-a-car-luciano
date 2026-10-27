import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

// Tekstovi su u rečnicima (whyUs.items), istim redom kao ikonice.
const icons = [
  <path key="car" d="M4 17h16M6 17v-4l2-5h8l2 5v4M9 17v2M15 17v2M7 10h10" strokeLinecap="round" strokeLinejoin="round" />,
  <path key="shield" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />,
  <path key="clock" d="M12 7v5l3.5 2M12 3a9 9 0 100 18 9 9 0 000-18z" strokeLinecap="round" strokeLinejoin="round" />,
];

export default function WhyUs() {
  const { t } = useI18n();
  const items = t.whyUs.items.map((item, i) => ({ ...item, icon: icons[i] }));
  const gridRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="zasto-mi" className="why-us">
      <div className="container why-us__inner">
        <h2 className="why-us__title">{t.whyUs.title}</h2>
        <div className={`why-us__grid${visible ? ' why-us__grid--visible' : ''}`} ref={gridRef}>
          {items.map((item, i) => (
            <div className="why-us__card" key={item.title} style={{ transitionDelay: `${i * 90}ms` }}>
              <svg className="why-us__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                {item.icon}
              </svg>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
