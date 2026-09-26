import { useRef, useCallback } from 'react'
import type { AttemptViolations } from './assessmentTypes'

/**
 * Violation monitoring hook.
 * Detects and counts browser-level test violations.
 * IMPORTANT: This only detects browser events — it does NOT guarantee cheating detection.
 */
export function useViolationMonitor() {
  const violations = useRef<AttemptViolations>({
    fullscreen_exits:       0,
    visibility_changes:     0,
    copy_attempts:          0,
    paste_attempts:         0,
    context_menu_attempts:  0,
    window_blurs:           0,
  })

  const startMonitoring = useCallback(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        violations.current.visibility_changes++
      }
    }

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        violations.current.fullscreen_exits++
      }
    }

    const onBlur = () => {
      violations.current.window_blurs++
    }

    const onCopy = (e: ClipboardEvent) => {
      violations.current.copy_attempts++
    }

    const onPaste = (e: ClipboardEvent) => {
      violations.current.paste_attempts++
    }

    const onContextMenu = (e: MouseEvent) => {
      violations.current.context_menu_attempts++
      e.preventDefault()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  const getViolations = useCallback((): AttemptViolations => {
    return { ...violations.current }
  }, [])

  const requestFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch (_) {
      // Fullscreen not available or denied — not a fatal error
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen()
      }
    } catch (_) {}
  }, [])

  return { startMonitoring, getViolations, requestFullscreen, exitFullscreen }
}
