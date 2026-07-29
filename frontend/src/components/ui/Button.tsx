import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:brightness-110',
        secondary: 'border-[1.5px] border-brand text-brand hover:bg-brand/8',
        ghost: 'text-ink-secondary hover:bg-ink/6',
        destructive: 'bg-status-critical text-white hover:brightness-110',
      },
      size: {
        sm: 'text-[12.5px] px-3 py-1.5',
        md: 'text-sm px-[18px] py-2.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
