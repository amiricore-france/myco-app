import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne des classes Tailwind en évitant les conflits.
 * Usage : cn('px-4', condition && 'py-2', 'text-red-500')
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
