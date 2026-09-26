import React from 'react'
import { cx } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  loading?: boolean
  as?: 'button' | 'a'
  href?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cx(
          'btn',
          `btn--${variant}`,
          size === 'sm' && 'btn--sm',
          size === 'lg' && 'btn--lg',
          fullWidth && 'btn--full',
          loading && 'btn--loading',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span
            className="spinner spinner--sm"
            style={{ borderTopColor: variant === 'primary' ? 'white' : 'var(--color-accent-600)' }}
          />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
