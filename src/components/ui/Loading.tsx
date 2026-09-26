import React from 'react'

export function LoadingSpinner({ size = 'md', label = 'Loading...' }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <span
      className={`spinner spinner--${size}`}
      role="status"
      aria-label={label}
    />
  )
}

export function LoadingPage() {
  return (
    <div className="loading-page">
      <LoadingSpinner size="lg" />
      <p className="loading-page__text">Loading…</p>
    </div>
  )
}
