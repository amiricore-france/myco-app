import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';

/** Encart d'invitation à Premium, affiché à la place d'une fonctionnalité réservée. */
export default function PremiumUpsell({ title, children, compact = false }) {
  return (
    <div className={`rounded-lg border border-primary-200 bg-primary-50 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary-600 p-1.5 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-primary-900">{title}</h3>
            <span className="rounded-sm bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Premium</span>
          </div>
          <div className="mt-1 text-sm text-primary-900/80">{children}</div>
          <Button asChild size="sm" className="mt-3">
            <Link to="/profile#premium">Découvrir Myco Premium</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
