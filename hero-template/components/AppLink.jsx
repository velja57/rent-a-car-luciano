import { useI18n } from '../i18n';

// Običan link; ako sajt prosledi renderLink, unutrašnji linkovi idu preko njega.
export default function AppLink({ href, ...props }) {
  const { renderLink } = useI18n();
  if (renderLink && !href.startsWith('#')) return renderLink({ href, ...props });
  return <a href={href} {...props} />;
}
