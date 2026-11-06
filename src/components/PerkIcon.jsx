// Ikonice pogodnosti (traka ispod hero-a i sekcija "Zašto Luciano").
const PATHS = {
  airport: (
    <path
      d="M10.5 4.5L12 10l6.5-1.5a1.6 1.6 0 01.8 3.1L13 13.5l-1.5 6-2 .5.5-6.5-4 1-1 2-1.5.4.4-3.4-2-2 1.4-.6 2 1.2 4-1L7 5z"
      strokeLinejoin="round"
    />
  ),
  deposit: <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  payLater: <path d="M3 7h18v12H3zM3 11h18M7 15h4" strokeLinecap="round" strokeLinejoin="round" />,
  roadside: (
    <path
      d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  inspected: <path d="M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  included: <path d="M20 12a8 8 0 11-16 0 8 8 0 0116 0zM8.5 12l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />,
  cancel: <path d="M12 7v5l3.5 2M12 3a9 9 0 100 18 9 9 0 000-18z" strokeLinecap="round" strokeLinejoin="round" />,
  flexible: <path d="M4 7h16v13H4zM4 11h16M9 4v5M15 4v5" strokeLinecap="round" strokeLinejoin="round" />,
  discount: (
    <path
      d="M19 5L5 19M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export default function PerkIcon({ name, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
