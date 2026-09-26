import React from 'react'
import { cx } from '../../lib/utils'

interface SelectOption {
  value: string | number
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  options: SelectOption[]
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, required, options, placeholder, id, className, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={selectId} className={cx('form-label', required && 'form-label--required')}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cx('form-select', className)}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && <p className="form-hint">{hint}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
