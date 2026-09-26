/**
 * Full-Screen AI Mock Interview Simulator Room
 * - True fullscreen video call simulation with AI Interviewer avatar
 * - Real-time microphone capture with live speech-to-text transcript
 * - AI Voice Speech Synthesis speaking questions and follow-ups out loud
 * - Animated audio visualizers, scratchpad, timer, and comprehensive evaluation scorecard
 */
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import {
  type InterviewConfig,
  type InterviewTurn,
  type InterviewEvaluation,
  type MockInterviewSession,
  getNextInterviewTurn,
  evaluateInterview,
  saveInterviewSession,
} from '../../features/interview/interviewService'
import { useInterviewSpeech } from '../../features/interview/useInterviewSpeech'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  PhoneOff,
  Send,
  Code2,
  MessageSquare,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  FileText,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react'

export function InterviewRoomPage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()
  const navigate = useNavigate()

  // Load config from sessionStorage
  const [config, setConfig] = useState<InterviewConfig>(() => {
    try {
      const raw = sessionStorage.getItem('preppilot_active_interview_config')
      if (raw) return JSON.parse(raw)
    } catch { /* fallback */ }
    return {
      roleName: 'Software Engineer',
      category: 'technical',
      difficulty: 'entry_level',
      totalQuestions: 5,
      enableMic: true,
    }
  })

  // State
  const [sessionId] = useState(() => 'intv_' + Math.random().toString(36).slice(2, 9))
  const [questionNumber, setQuestionNumber] = useState(1)
  const [turns, setTurns] = useState<InterviewTurn[]>([])
  const [currentAiSpeech, setCurrentAiSpeech] = useState<string>('')
  const [interviewerStatus, setInterviewerStatus] = useState<'speaking' | 'listening' | 'thinking' | 'idle'>('thinking')
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showScratchpad, setShowScratchpad] = useState(false)
  const [scratchpadCode, setScratchpadCode] = useState('// Use this scratchpad for code or system design notes\n')
  const [showTranscript, setShowTranscript] = useState(false)
  const [textInputFallback, setTextInputFallback] = useState('')
  const [showTypeInput, setShowTypeInput] = useState(false)

  // Speech Hook
  const {
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    micVolume,
    startMic,
    stopMic,
    speakText,
    stopAiSpeaking,
    isAiSpeaking,
    clearTranscript,
  } = useInterviewSpeech()

  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  // Elapsed timer
  useEffect(() => {
    if (evaluation) return
    const timer = setInterval(() => {
      setElapsedSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [evaluation])

  // Initial Turn on Mount
  useEffect(() => {
    let mounted = true

    async function initInterview() {
      setInterviewerStatus('thinking')
      try {
        const firstTurn = await getNextInterviewTurn({
          studentId: appUser?.auth.id,
          roleName: config.roleName,
          category: config.category,
          difficulty: config.difficulty,
          questionNumber: 1,
          totalQuestions: config.totalQuestions,
          history: [],
        })

        if (!mounted) return

        const initialTurnObj: InterviewTurn = {
          id: 'turn_1',
          speaker: 'interviewer',
          text: firstTurn.response,
          feedbackNote: firstTurn.feedbackNote,
          topic: firstTurn.suggestedTopic || 'Introduction',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setTurns([initialTurnObj])
        setCurrentAiSpeech(firstTurn.response)
        setInterviewerStatus('speaking')

        // Speak aloud
        speakText(firstTurn.response, () => {
          if (!mounted) return
          setInterviewerStatus('listening')
          if (config.enableMic) {
            startMic()
          }
        })
      } catch (e: any) {
        toastError('Failed to initialize interview AI')
      }
    }

    initInterview()

    return () => {
      mounted = false
      stopAiSpeaking()
      stopMic()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, transcript, interimTranscript])

  // Fullscreen handlers
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Handle Candidate Submitting an Answer
  async function handleSubmitAnswer() {
    const candidateAnswer = (transcript + ' ' + interimTranscript + ' ' + textInputFallback).trim()
    if (!candidateAnswer) {
      toastError('Please speak or type your answer before proceeding.')
      return
    }

    // Stop mic and reset input
    stopMic()
    const userTurn: InterviewTurn = {
      id: `turn_cand_${questionNumber}`,
      speaker: 'candidate',
      text: candidateAnswer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const updatedTurns = [...turns, userTurn]
    setTurns(updatedTurns)
    clearTranscript()
    setTextInputFallback('')
    setShowTypeInput(false)

    // Check if reached end
    const nextQ = questionNumber + 1
    const isFinished = questionNumber >= config.totalQuestions

    if (isFinished) {
      await finishInterview(updatedTurns)
      return
    }

    // Fetch next AI turn
    setQuestionNumber(nextQ)
    setInterviewerStatus('thinking')

    try {
      const nextTurn = await getNextInterviewTurn({
        studentId: appUser?.auth.id,
        roleName: config.roleName,
        category: config.category,
        difficulty: config.difficulty,
        questionNumber: nextQ,
        totalQuestions: config.totalQuestions,
        history: updatedTurns,
        candidateLastAnswer: candidateAnswer,
      })

      const aiTurnObj: InterviewTurn = {
        id: `turn_ai_${nextQ}`,
        speaker: 'interviewer',
        text: nextTurn.response,
        feedbackNote: nextTurn.feedbackNote,
        topic: nextTurn.suggestedTopic || `Question ${nextQ}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setTurns([...updatedTurns, aiTurnObj])
      setCurrentAiSpeech(nextTurn.response)
      setInterviewerStatus('speaking')

      // Speak aloud
      speakText(nextTurn.response, () => {
        setInterviewerStatus('listening')
        if (config.enableMic) {
          startMic()
        }
      })
    } catch {
      toastError('Failed to fetch next question. Moving forward.')
    }
  }

  // Finish & Evaluate Interview
  async function finishInterview(allTurns: InterviewTurn[]) {
    stopAiSpeaking()
    stopMic()
    setIsEvaluating(true)
    setInterviewerStatus('thinking')

    try {
      const evalResult = await evaluateInterview({
        studentId: appUser?.auth.id,
        roleName: config.roleName,
        category: config.category,
        difficulty: config.difficulty,
        turns: allTurns,
      })

      setEvaluation(evalResult)

      // Save complete session
      const completedSession: MockInterviewSession = {
        id: sessionId,
        studentId: appUser?.auth.id || 'anonymous',
        roleName: config.roleName,
        category: config.category,
        difficulty: config.difficulty,
        totalQuestions: config.totalQuestions,
        durationSeconds: elapsedSeconds,
        turns: allTurns,
        evaluation: evalResult,
        status: 'completed',
        createdAt: new Date().toISOString(),
      }

      await saveInterviewSession(completedSession)
      success('Mock interview completed! Scorecard ready.')
    } catch (e) {
      toastError('Failed to generate full evaluation.')
    } finally {
      setIsEvaluating(false)
    }
  }

  // Replay Question Speech
  function handleReplayVoice() {
    if (!currentAiSpeech) return
    setInterviewerStatus('speaking')
    speakText(currentAiSpeech, () => {
      setInterviewerStatus('listening')
      if (config.enableMic) {
        startMic()
      }
    })
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // If Evaluation Report is ready, display Fullscreen Scorecard
  if (evaluation) {
    return (
      <EvaluationReportView
        config={config}
        evaluation={evaluation}
        turns={turns}
        durationSeconds={elapsedSeconds}
        onRetake={() => {
          window.location.reload()
        }}
        onExit={() => {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          }
          navigate('/interview')
        }}
      />
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#090d16',
      color: '#f8fafc',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden',
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        height: 56,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Left: Role & Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.02em', color: '#f1f5f9' }}>
              {config.roleName} Mock Interview
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'capitalize' }}>
            {config.category.replace('_', ' ')}
          </span>
        </div>

        {/* Center: Question Progress & Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}>
            Question {questionNumber} of {config.totalQuestions}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
            <Clock size={13} /> {formatTime(elapsedSeconds)}
          </div>
        </div>

        {/* Right: View Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowScratchpad(s => !s)}
            style={{
              background: showScratchpad ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${showScratchpad ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: showScratchpad ? '#a5b4fc' : '#cbd5e1',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Code2 size={14} /> Scratchpad
          </button>

          <button
            onClick={() => setShowTranscript(t => !t)}
            style={{
              background: showTranscript ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${showTranscript ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: showTranscript ? '#a5b4fc' : '#cbd5e1',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <MessageSquare size={14} /> Transcript
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* ── Main Stage Area ── */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Left: Video & Voice Stage */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', padding: '20px', gap: '16px', overflowY: 'auto' }}>
          {/* Main Interviewer Video Stage */}
          <div style={{
            flex: 1,
            minHeight: '280px',
            background: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}>
            {/* Background Soundwave Glow */}
            <div style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: isAiSpeaking ? 'radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, rgba(99, 102, 241, 0) 70%)' : 'transparent',
              filter: 'blur(20px)',
              transition: 'all 0.3s ease',
              animation: isAiSpeaking ? 'pulse 2s infinite ease-in-out' : 'none',
            }} />

            {/* AI Avatar */}
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isAiSpeaking ? '0 0 30px rgba(99, 102, 241, 0.6)' : '0 8px 24px rgba(0,0,0,0.4)',
              transition: 'all 0.3s ease',
              transform: isAiSpeaking ? 'scale(1.06)' : 'scale(1)',
              zIndex: 2,
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}>
                <Sparkles size={40} />
              </div>
            </div>

            {/* AI Name & Live Status Badge */}
            <div style={{ marginTop: '16px', textAlign: 'center', zIndex: 2 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                AI Placement Bar-Raiser
              </div>
              <div style={{
                marginTop: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: isAiSpeaking
                  ? 'rgba(56, 189, 248, 0.15)'
                  : interviewerStatus === 'listening'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(234, 179, 8, 0.15)',
                color: isAiSpeaking
                  ? '#38bdf8'
                  : interviewerStatus === 'listening'
                  ? '#4ade80'
                  : '#facc15',
                border: `1px solid ${
                  isAiSpeaking
                    ? 'rgba(56, 189, 248, 0.3)'
                    : interviewerStatus === 'listening'
                    ? 'rgba(34, 197, 94, 0.3)'
                    : 'rgba(234, 179, 8, 0.3)'
                }`,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isAiSpeaking ? '#38bdf8' : interviewerStatus === 'listening' ? '#4ade80' : '#facc15',
                  animation: 'pulse 1.5s infinite',
                }} />
                {isAiSpeaking ? 'Speaking question...' : interviewerStatus === 'listening' ? 'Listening to your response' : 'Thinking & Analyzing...'}
              </div>
            </div>

            {/* Subtitles / Current Spoken Words Banner */}
            {currentAiSpeech && (
              <div style={{
                position: 'absolute',
                bottom: 16,
                left: 20,
                right: 20,
                padding: '12px 18px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#f8fafc',
                fontSize: '13px',
                lineHeight: 1.5,
                textAlign: 'center',
                zIndex: 2,
              }}>
                <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Interviewer Question
                </span>
                "{currentAiSpeech}"
                <button
                  onClick={handleReplayVoice}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#818cf8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    marginLeft: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontWeight: 600,
                  }}
                  title="Replay Voice"
                >
                  <RotateCcw size={11} /> Replay
                </button>
              </div>
            )}

            {/* Candidate Small PIP Tile (Top Right inside video) */}
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 160,
              padding: '10px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: `1px solid ${isListening ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255,255,255,0.1)'}`,
              zIndex: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>You (Candidate)</span>
                {isListening ? (
                  <span style={{ color: '#4ade80', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                    <Mic size={10} /> Live
                  </span>
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '10px' }}>Mic off</span>
                )}
              </div>

              {/* Dynamic Sound Wave Bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: 16, justifyContent: 'center' }}>
                {[0.4, 0.8, 1, 0.7, 0.9, 0.5, 0.8].map((factor, i) => {
                  const barHeight = isListening ? Math.max(3, Math.min(16, (micVolume * factor) / 4)) : 3
                  return (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: barHeight,
                        borderRadius: 2,
                        background: isListening ? '#4ade80' : 'rgba(255,255,255,0.2)',
                        transition: 'height 0.08s ease',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Candidate Live Response & Speech Ticker */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '14px 18px',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                  Your Spoken Answer
                </span>
                {isListening && (
                  <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 600 }}>
                    (Transcribing live...)
                  </span>
                )}
              </div>

              <button
                onClick={() => setShowTypeInput(t => !t)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#818cf8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {showTypeInput ? 'Hide Type Box' : 'Type Instead'}
              </button>
            </div>

            {/* Live speech preview */}
            {!showTypeInput ? (
              <div style={{
                minHeight: 52,
                fontSize: '14px',
                color: transcript || interimTranscript ? '#f1f5f9' : '#64748b',
                lineHeight: 1.6,
                fontStyle: transcript || interimTranscript ? 'normal' : 'italic',
              }}>
                {transcript}
                {interimTranscript && (
                  <span style={{ color: '#38bdf8', opacity: 0.9 }}> {interimTranscript}</span>
                )}
                {!transcript && !interimTranscript && (
                  isListening
                    ? "Start speaking... your words will appear here in real time."
                    : "Microphone is muted. Click the microphone below to begin speaking."
                )}
              </div>
            ) : (
              <textarea
                value={textInputFallback}
                onChange={e => setTextInputFallback(e.target.value)}
                placeholder="Type your response here if in a noisy environment or unable to speak..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            )}
          </div>
        </div>

        {/* Right Drawer: Scratchpad / Code Editor */}
        {showScratchpad && (
          <div style={{
            width: 380,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={14} color="#818cf8" /> Candidate Scratchpad
              </span>
              <button onClick={() => setShowScratchpad(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}>
                Close
              </button>
            </div>
            <textarea
              value={scratchpadCode}
              onChange={e => setScratchpadCode(e.target.value)}
              style={{
                flex: 1,
                background: '#0b1120',
                color: '#e2e8f0',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '16px',
                border: 'none',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>
        )}

        {/* Right Drawer: Live Transcript */}
        {showTranscript && (
          <div style={{
            width: 360,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={14} color="#38bdf8" /> Live Transcript
              </span>
              <button onClick={() => setShowTranscript(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}>
                Close
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {turns.map(turn => (
                <div
                  key={turn.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: turn.speaker === 'interviewer' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${turn.speaker === 'interviewer' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: turn.speaker === 'interviewer' ? '#38bdf8' : '#a5b4fc' }}>
                      {turn.speaker === 'interviewer' ? 'Interviewer' : 'You'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{turn.timestamp}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5 }}>
                    {turn.text}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Controls Bar ── */}
      <div style={{
        height: 72,
        padding: '0 24px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Left: Mic toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              if (isListening) {
                stopMic()
              } else {
                startMic()
              }
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: isListening ? '#22c55e' : 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isListening ? '0 0 16px rgba(34, 197, 94, 0.4)' : 'none',
            }}
            title={isListening ? 'Mute Mic' : 'Unmute Mic'}
          >
            {isListening ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {isListening ? 'Mic Active' : 'Mic Muted'}
          </span>
        </div>

        {/* Center: Primary Answer / Send Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmitAnswer}
            disabled={isEvaluating}
            style={{
              padding: '0 28px',
              height: 44,
              borderRadius: '999px',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              border: 'none',
              boxShadow: '0 4px 20px rgba(79, 70, 229, 0.4)',
            }}
          >
            <Send size={15} />
            {questionNumber >= config.totalQuestions ? 'Submit Final Answer & Get Evaluation' : 'Done Speaking · Submit Answer'}
          </Button>
        </div>

        {/* Right: End Interview Early */}
        <div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to end this interview? Your current transcript will be evaluated.')) {
                finishInterview(turns)
              }
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <PhoneOff size={14} /> End Interview
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Evaluation Report Screen ────────────────────────────────────────────────
function EvaluationReportView({
  config,
  evaluation,
  turns,
  durationSeconds,
  onRetake,
  onExit,
}: {
  config: InterviewConfig
  evaluation: InterviewEvaluation
  turns: InterviewTurn[]
  durationSeconds: number
  onRetake: () => void
  onExit: () => void
}) {
  const isHire = evaluation.verdict.includes('Hire')
  const mins = Math.round(durationSeconds / 60)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#090d16',
      color: '#f8fafc',
      zIndex: 1000,
      overflowY: 'auto',
      padding: '40px 20px',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 860, width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Evaluation Report
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px', color: '#ffffff' }}>
              {config.roleName} Mock Assessment
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" onClick={onRetake}>
              <RotateCcw size={14} style={{ marginRight: 6 }} /> Try Another Mock
            </Button>
            <Button variant="primary" onClick={onExit}>
              Return to Studio
            </Button>
          </div>
        </div>

        {/* Scorecard Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '28px 32px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 2fr',
          gap: '28px',
          alignItems: 'center',
        }}>
          {/* Big Score Dial */}
          <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '20px' }}>
            <div style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1, color: isHire ? '#22c55e' : '#f59e0b' }}>
              {evaluation.overall_score}
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', fontWeight: 500 }}>
              Overall Readiness Score / 100
            </div>
            <div style={{ marginTop: '12px' }}>
              <span style={{
                padding: '4px 14px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                background: isHire ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: isHire ? '#4ade80' : '#fbbf24',
                border: `1px solid ${isHire ? 'rgba(34, 197, 94, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              }}>
                Verdict: {evaluation.verdict}
              </span>
            </div>
          </div>

          {/* Breakdown bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Technical Depth & Accuracy</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{evaluation.technical_score}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${evaluation.technical_score}%`, height: '100%', background: '#38bdf8' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Communication & Structure</span>
                <span style={{ color: '#a855f7', fontWeight: 700 }}>{evaluation.communication_score}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${evaluation.communication_score}%`, height: '100%', background: '#a855f7' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Confidence & Pacing</span>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>{evaluation.confidence_score}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${evaluation.confidence_score}%`, height: '100%', background: '#22c55e' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Feedback */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>
            Bar-Raiser Summary
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
            {evaluation.summary}
          </p>
        </div>

        {/* Strengths & Improvements Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Key Strengths */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} /> Key Strengths
            </h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {evaluation.key_strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} /> Areas to Strengthen
            </h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {evaluation.areas_for_improvement.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Question Breakdown */}
        {evaluation.question_evaluations?.length > 0 && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>
              Question-by-Question Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {evaluation.question_evaluations.map((q, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                      Question #{i + 1}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: q.rating === 'excellent' ? 'rgba(34, 197, 94, 0.2)' : q.rating === 'good' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: q.rating === 'excellent' ? '#4ade80' : q.rating === 'good' ? '#38bdf8' : '#fbbf24',
                    }}>
                      {q.rating}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {q.question}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                    {q.feedback}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', paddingBottom: '40px' }}>
          <Button variant="primary" size="lg" onClick={onRetake}>
            <RotateCcw size={16} style={{ marginRight: 6 }} /> Start Another Session
          </Button>
          <Button variant="secondary" size="lg" onClick={onExit}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
