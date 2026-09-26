import React from 'react'
import { cx } from '../../lib/utils'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cx('badge', `badge--${variant}`, className)}>
      {children}
    </span>
  )
}
