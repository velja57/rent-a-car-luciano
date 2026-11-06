import { Link } from 'react-router';
import { useI18n } from '../i18n';
import { usePageMeta } from '../lib/usePageMeta';
import * as en from '../legal/en';
import * as sr from '../legal/sr';
import '../components/Fleet.css';
import './LegalPage.css';

const DOCS = { sr, en };
const LINK = /(\[[^\]]+\]\([^)]+\))/g;

// Tekst sa linkovima "[tekst](adresa)": interni preko routera, spoljni u novom tabu.
function RichText({ text }) {
  return text.split(LINK).map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) return part;
    const [, label, href] = match;
    return href.startsWith('/') ? (
      <Link key={i} to={href}>
        {label}
      </Link>
    ) : (
      <a key={i} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  });
}

// Uslovi najma (doc="terms") i politika privatnosti (doc="privacy"), na jeziku iz adrese.
export default function LegalPage({ doc }) {
  const { lang, t, paths } = useI18n();
  const page = DOCS[lang][doc];
  const l = t.legal;
  usePageMeta(doc === 'terms' ? t.meta.termsTitle : t.meta.privacyTitle, doc === 'terms' ? t.meta.termsDescription : t.meta.privacyDescription);

  return (
    <div className="legal">
      <div className="fleet__bg" aria-hidden="true" />
      <div className="container legal__inner">
        <header className="legal__head">
          <span className="fleet__eyebrow">
            <span className="fleet__pulse" />
            {page.eyebrow}
          </span>
          <h1 className="fleet__title">
            {page.title[0]}
            <span>{page.title[1]}</span>
          </h1>
          <p className="legal__updated">
            {l.updated}: {page.updated}
          </p>
          {page.intro.map((text) => (
            <p className="legal__intro" key={text}>
              <RichText text={text} />
            </p>
          ))}
        </header>

        <div className="legal__layout">
          <nav className="legal__toc" aria-label={l.toc}>
            <p className="legal__toc-title">{l.toc}</p>
            <ol>
              {page.sections.map((section) => (
                <li key={section.id}>
                  <Link to={`#${section.id}`}>{section.title}</Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="legal__body">
            {page.sections.map((section, i) => (
              <section className="legal__section" id={section.id} key={section.id}>
                <h2>
                  {i + 1}. {section.title}
                </h2>
                {section.blocks.map((block, j) =>
                  Array.isArray(block) ? (
                    <ul key={j}>
                      {block.map((item) => (
                        <li key={item}>
                          <RichText text={item} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j}>
                      <RichText text={block} />
                    </p>
                  ),
                )}
              </section>
            ))}

            <p className="legal__other">
              <Link to={doc === 'terms' ? paths.privacy : paths.terms}>
                {doc === 'terms' ? l.seePrivacy : l.seeTerms} →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
