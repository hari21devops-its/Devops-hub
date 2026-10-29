import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
        success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        danger: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
