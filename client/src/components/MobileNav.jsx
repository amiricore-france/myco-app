import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Map, MapPin, Share2, Sprout, Footprints } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { cn } from '../lib/utils';

const ITEMS = [
  { to: '/',             label: 'Carte',       icon: Map,       end: true },
  { to: '/sortie',       label: 'Sortie',      icon: Footprints },
  { to: '/cueillettes',  label: 'Cueillettes', icon: Sprout },
  { to: '/spots',        label: 'Coins',       icon: MapPin },
  { to: '/shares',       label: 'Partages',    icon: Share2 },
];

export default function MobileNav() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshCount() {
    if (!user) return setPendingCount(0);
    try {
      const data = await api('/shares/pending-count', { silent401: true });
      setPendingCount(data.count || 0);
    } catch {
      setPendingCount(0);
    }
  }

  useEffect(() => { refreshCount(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(refreshCount, 30000);
    function onChange() { refreshCount(); }
    window.addEventListener('shares:changed', onChange);
    return () => {
      clearInterval(t);
      window.removeEventListener('shares:changed', onChange);
    };
  }, [user]);

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors hover:no-underline',
                'min-h-[60px]',
                isActive
                  ? 'text-primary-700'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                    {item.to === '/shares' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-500 px-1 text-[10px] font-bold text-warning-900">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
