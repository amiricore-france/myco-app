import { Link } from 'react-router-dom';

/**
 * Mise en page commune aux écrans d'authentification publics
 * (connexion, mot de passe oublié, réinitialisation, vérification).
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-8 sm:py-12">
      <Link to="/" className="mb-8 text-center">
        <div className="mb-3 text-5xl sm:text-6xl">🍄</div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Myco</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </Link>

      <div className="w-full max-w-[420px]">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          {title && <h2 className="mb-4 text-xl font-semibold text-neutral-900">{title}</h2>}
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-neutral-500">{footer}</div>}
      </div>
    </div>
  );
}
