import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Countdown timer hook.
 * - Counts down from totalSeconds to 0.
 * - Calls onExpire when it reaches 0.
 * - start() begins the timer. pause() pauses it. reset() resets to totalSeconds.
 */
export function useTimer(totalSeconds: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(totalSeconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onExpireRef = useRef(onExpire)

  // Keep ref current so interval closure doesn't capture stale callback
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          onExpireRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const start  = useCallback(() => setRunning(true),  [])
  const pause  = useCallback(() => setRunning(false), [])
  const reset  = useCallback(() => { setRunning(false); setRemaining(totalSeconds) }, [totalSeconds])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const percentLeft = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0
  const isWarning = remaining <= 300   // last 5 minutes
  const isCritical = remaining <= 60  // last 60 seconds

  return { remaining, formatted, percentLeft, isWarning, isCritical, running, start, pause, reset }
}
