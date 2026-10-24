import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, LogOut, User } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = (user.name || user.email || '?')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <NavLink to="/" className="flex items-center gap-2 font-bold text-neutral-900 hover:no-underline">
          <span className="text-xl">🍄</span>
          <span>Myco</span>
        </NavLink>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center rounded-full p-1 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <Avatar className="h-8 w-8">
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
            <DropdownMenuItem onSelect={() => navigate('/dashboard')}>
              <BarChart3 className="h-4 w-4" />
              Tableau de bord
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
    </header>
  );
}
