import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Map, MapPin, Share2, BarChart3, LogOut, User, Sprout } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { to: '/',             label: 'Carte',            icon: Map,       end: true },
  { to: '/cueillettes',  label: 'Cueillettes',      icon: Sprout },
  { to: '/spots',        label: 'Mes coins',        icon: MapPin },
  { to: '/shares',       label: 'Partages',         icon: Share2 },
  { to: '/dashboard',    label: 'Tableau de bord',  icon: BarChart3 },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  const initials = (user.name || user.email || '?')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-2 px-4 sm:px-6 lg:px-8">

        <NavLink to="/" className="flex items-center gap-2 font-bold text-neutral-900 hover:no-underline mr-2">
          <span className="text-2xl">🍄</span>
          <span className="hidden sm:inline text-lg">Myco</span>
        </NavLink>

        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:no-underline',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.to === '/shares' && pendingCount > 0 && (
                  <Badge variant="warning" className="ml-1 h-5 min-w-5 justify-center px-1.5">
                    {pendingCount}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="flex-1 md:hidden" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                {user.name && <p className="text-sm font-medium">{user.name}</p>}
                <p className="text-xs text-neutral-500 truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              <User className="h-4 w-4" />
              Mon compte
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => { logout(); navigate('/login'); }}
              className="text-danger-600 focus:text-danger-600 focus:bg-danger-50"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </nav>
  );
}
