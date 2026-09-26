/**
 * useInterviewSpeech Hook
 * - Web Speech API Speech-to-Text with live interim transcript
 * - Audio visualizer analyzer for microphone volume / wave levels
 * - Web Speech Synthesis for AI speaking with event hooks
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { InterviewVoiceSpeaker } from './interviewService'

// Extend window for webkitSpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

export function useInterviewSpeech() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt')
  const [micVolume, setMicVolume] = useState(0) // 0 to 100 for live waveform
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')

  const recognitionRef = useRef<any>(null)
  const speakerRef = useRef<InterviewVoiceSpeaker | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isIntentionalStopRef = useRef(false)

  // Initialize Voice Speaker & load voices
  useEffect(() => {
    speakerRef.current = new InterviewVoiceSpeaker()

    function loadVoices() {
      if (speakerRef.current) {
        const voices = speakerRef.current.getAvailableVoices()
        setAvailableVoices(voices)
        if (voices.length > 0 && !selectedVoice) {
          const natural = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel'))
          setSelectedVoice(natural ? natural.name : voices[0].name)
        }
      }
    }

    loadVoices()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      speakerRef.current?.stop()
      stopMic()
    }
  }, [])

  // Initialize Speech Recognition
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      setMicPermission('granted')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalStr = ''
      let interimStr = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i]
        if (item.isFinal) {
          finalStr += item[0].transcript + ' '
        } else {
          interimStr += item[0].transcript
        }
      }

      if (finalStr) {
        setTranscript(prev => (prev ? prev + ' ' : '') + finalStr.trim())
      }
      setInterimTranscript(interimStr)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setMicPermission('denied')
        setIsListening(false)
      } else if (event.error !== 'no-speech') {
        console.warn('[SpeechRecognition] error:', event.error)
      }
    }

    recognition.onend = () => {
      // Auto-restart if still meant to be listening and not AI speaking
      if (!isIntentionalStopRef.current && isListening) {
        try {
          recognition.start()
        } catch {
          setIsListening(false)
        }
      } else {
        setIsListening(false)
        setInterimTranscript('')
      }
    }

    return recognition
  }, [isListening])

  // Setup Web Audio Analyser for live visual waveform
  const startAudioMeter = async (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return

      const ctx = new AudioCtx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.5

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = ctx
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)))
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // AudioContext fallback
    }
  }

  // Start Mic & Speech-to-Text
  const startMic = useCallback(async () => {
    // If AI is speaking, stop AI speech before listening
    if (speakerRef.current?.isSpeaking()) {
      speakerRef.current.stop()
      setIsAiSpeaking(false)
    }

    isIntentionalStopRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setMicPermission('granted')
      await startAudioMeter(stream)

      if (!recognitionRef.current) {
        recognitionRef.current = initRecognition()
      }

      if (recognitionRef.current) {
        recognitionRef.current.start()
      } else {
        setIsListening(true)
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setMicPermission('denied')
      }
      console.warn('Microphone permission or start error:', err)
    }
  }, [initRecognition])

  // Stop Mic
  const stopMic = useCallback(() => {
    isIntentionalStopRef.current = true
    setIsListening(false)
    setInterimTranscript('')
    setMicVolume(0)

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch { /* ignore */ }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }, [])

  // Speak AI Response
  const speakText = useCallback((
    text: string,
    onFinish?: () => void
  ) => {
    if (!speakerRef.current) {
      onFinish?.()
      return
    }

    // Temporarily pause mic while AI is speaking so it doesn't transcribe itself
    const wasListening = isListening
    if (wasListening) {
      stopMic()
    }

    setIsAiSpeaking(true)

    speakerRef.current.speak(text, {
      voiceName: selectedVoice,
      rate: 1.05,
      pitch: 1.0,
      onStart: () => {
        setIsAiSpeaking(true)
      },
      onEnd: () => {
        setIsAiSpeaking(false)
        onFinish?.()
      },
      onError: () => {
        setIsAiSpeaking(false)
        onFinish?.()
      },
    })
  }, [isListening, selectedVoice, stopMic])

  const stopAiSpeaking = useCallback(() => {
    speakerRef.current?.stop()
    setIsAiSpeaking(false)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  return {
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    micPermission,
    micVolume,
    isAiSpeaking,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    startMic,
    stopMic,
    speakText,
    stopAiSpeaking,
    clearTranscript,
    hasSpeechRecognition: typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
  }
}
