import React from 'react'
import { cx } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, id, className, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={inputId} className={cx('form-label', required && 'form-label--required')}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cx('form-input', error && 'form-input--error', className)}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {hint && !error && (
          <p id={`${inputId}-hint`} className="form-hint">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="form-error">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
