import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-sky-600 text-white hover:bg-sky-500',
        outline: 'border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800',
        ghost: 'text-slate-200 hover:bg-slate-800',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  leadingIcon?: ReactNode
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  leadingIcon,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  if (asChild) {
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Comp>
    )
  }

  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {leadingIcon ? <span className="inline-flex items-center">{leadingIcon}</span> : null}
      {children}
    </button>
  )
}
