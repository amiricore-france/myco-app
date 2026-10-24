import { Link } from 'react-router-dom';

export const LEGAL_LINKS = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/cgu', label: 'CGU' },
  { to: '/confidentialite', label: 'Confidentialité' }
];

/** Liens vers les pages légales (pied de page, compte, inscription). */
export default function LegalLinks({ className = '' }) {
  return (
    <nav aria-label="Informations légales" className={className}>
      {LEGAL_LINKS.map((l, i) => (
        <span key={l.to}>
          {i > 0 && <span className="mx-2" aria-hidden>·</span>}
          <Link to={l.to} className="hover:text-primary-700 hover:underline">{l.label}</Link>
        </span>
      ))}
    </nav>
  );
}
