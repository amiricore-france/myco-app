import { Link } from 'react-router-dom';

export const LEGAL_LINKS = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/cgu', label: 'CGU' },
  { to: '/confidentialite', label: 'Confidentialité' }
];

/**
 * Liens vers les pages légales (pied de page, compte, inscription).
 * div role="navigation" plutôt que <nav> : le style legacy `nav` de styles.css
 * (bandeau vert, liens blancs) rendait ces liens illisibles.
 */
export default function LegalLinks({ className = '' }) {
  return (
    <div role="navigation" aria-label="Informations légales" className={className}>
      {LEGAL_LINKS.map((l, i) => (
        <span key={l.to}>
          {i > 0 && <span className="mx-2" aria-hidden>·</span>}
          <Link to={l.to} className="hover:text-primary-700 hover:underline">{l.label}</Link>
        </span>
      ))}
    </div>
  );
}
