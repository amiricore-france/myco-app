import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-600 text-white',
        primary: 'border-primary-200 bg-primary-50 text-primary-900',
        sage: 'border-sage-200 bg-sage-50 text-sage-800',
        warning: 'border-warning-200 bg-warning-50 text-warning-900',
        danger: 'border-danger-200 bg-danger-50 text-danger-900',
        info: 'border-info-200 bg-info-50 text-info-900',
        neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700',
        'danger-solid': 'border-transparent bg-danger-700 text-white font-extrabold uppercase tracking-wider',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
