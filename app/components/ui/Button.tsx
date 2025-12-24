import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-pill text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-borderColorActive disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Applying glassmorphism effect to the default button
        default: 'bg-accent-500/10 border border-accent-500/20 text-accent-500 backdrop-blur-sm hover:bg-accent-500/20',
        destructive: 'bg-red-500/80 border border-red-500/90 text-white backdrop-blur-sm hover:bg-red-500/90',
        outline:
          'border border-bolt-elements-borderColor bg-transparent backdrop-blur-sm hover:bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary',
        secondary:
          'bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary hover:bg-bolt-elements-bg-depth-4',
        ghost: 'hover:bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary',
        link: 'text-bolt-elements-textPrimary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-9 rounded-pill px-4',
        lg: 'h-12 rounded-pill px-8 text-md',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, _asChild = false, ...props }, ref) => {
    return <button className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
