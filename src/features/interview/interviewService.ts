/**
 * Mock Interview Service
 * - Handles conversational interview turns with AI Gateway / Gemini
 * - Synthesizes realistic AI speech via Web Speech API
 * - Transcribes student speech via Web Speech Recognition (mic access)
 * - Evaluates full interview performance (scores, verdict, coaching report)
 * - Persists sessions to Supabase and localStorage fallback
 */
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
export type InterviewCategory = 'technical' | 'behavioral' | 'system_design' | 'mixed'
export type InterviewDifficulty = 'intern' | 'entry_level' | 'mid_level'

export interface InterviewConfig {
  roleName: string
  category: InterviewCategory
  difficulty: InterviewDifficulty
  totalQuestions: number
  voiceName?: string
  enableMic: boolean
}

export interface InterviewTurn {
  id: string
  speaker: 'interviewer' | 'candidate'
  text: string
  feedbackNote?: string
  topic?: string
  timestamp: string
  audioEmotion?: 'friendly' | 'analytical' | 'encouraging'
}

export interface QuestionEvaluation {
  question: string
  candidate_answer: string
  rating: 'excellent' | 'good' | 'average' | 'needs_work'
  feedback: string
}

export interface InterviewEvaluation {
  overall_score: number
  technical_score: number
  communication_score: number
  confidence_score: number
  verdict: 'Strong Hire' | 'Hire' | 'Lean Hire' | 'Needs Work'
  summary: string
  key_strengths: string[]
  areas_for_improvement: string[]
  question_evaluations: QuestionEvaluation[]
  recommended_topics: string[]
}

export interface MockInterviewSession {
  id: string
  studentId: string
  roleName: string
  category: InterviewCategory
  difficulty: InterviewDifficulty
  totalQuestions: number
  durationSeconds: number
  turns: InterviewTurn[]
  evaluation?: InterviewEvaluation
  status: 'in_progress' | 'completed' | 'abandoned'
  createdAt: string
}

// ─── Local Storage Cache Key ──────────────────────────────────────────────────
const STORAGE_KEY = 'preppilot_mock_interviews'

// ─── Starter Role-Specific Question Bank (Immediate Offline Fallbacks) ────────
const STARTER_QUESTIONS: Record<InterviewCategory, string[]> = {
  technical: [
    "Welcome! To start off our technical discussion, could you walk me through how a Hash Map works internally, including how collision resolution is handled?",
    "Great. Now suppose you need to find the longest substring without repeating characters in O(n) time. What data structure and algorithm would you use?",
    "Let's touch on databases. Can you explain the difference between Clustered and Non-Clustered Indexes, and when an index might degrade write performance?",
    "When designing an API endpoint that handles high write concurrency, how would you prevent race conditions or dirty reads?",
    "Finally, how do you approach diagnosing a memory leak in a production application?"
  ],
  behavioral: [
    "Welcome to the interview! To begin, tell me about yourself and what drew you to software engineering.",
    "Could you describe a challenging project where you faced a significant technical roadblock? How did you overcome it?",
    "Tell me about a time you had a technical disagreement with a teammate or peer. How did you resolve the situation?",
    "Can you share an instance where you had to learn an unfamiliar technology or framework under a tight deadline?",
    "Where do you see yourself technically in the next 2 to 3 years, and what skills are you actively developing?"
  ],
  system_design: [
    "Welcome! Today we will discuss high-level architecture. How would you design a scalable URL Shortening service like TinyURL?",
    "How would you handle caching for hot URLs, and what cache eviction policy would you implement?",
    "If our database traffic grows by 100x, how would you partition or shard the database without introducing downtime?",
    "How would you implement rate limiting to protect our API from denial-of-service spikes?",
    "How would you ensure high availability and disaster recovery across multiple geographical regions?"
  ],
  mixed: [
    "Welcome! Let's kick off with an introduction: tell me about your background and your strongest technical projects.",
    "In your favorite project, what was the most complex data structure or algorithm you implemented, and what were the trade-offs?",
    "If you were asked to optimize an SQL query joining three large tables that is timing out, what steps would you take?",
    "Tell me about a time a bug made it to production or testing. How did you diagnose it and what safeguard did you put in place?",
    "To conclude, how do you prioritize code quality versus shipping features quickly under placement or sprint deadlines?"
  ],
}

// ─── AI Turn Generation ───────────────────────────────────────────────────────
export async function getNextInterviewTurn(params: {
  studentId?: string
  roleName: string
  category: InterviewCategory
  difficulty: InterviewDifficulty
  questionNumber: number
  totalQuestions: number
  history: InterviewTurn[]
  candidateLastAnswer?: string
}): Promise<{
  response: string
  feedbackNote?: string
  isFinal: boolean
  suggestedTopic?: string
}> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: {
        feature: 'mock_interview_turn',
        student_id: params.studentId,
        role_name: params.roleName,
        interview_type: params.category,
        difficulty: params.difficulty,
        question_number: params.questionNumber,
        total_questions: params.totalQuestions,
        candidate_last_answer: params.candidateLastAnswer ?? '',
        history: params.history.map(t => ({
          speaker: t.speaker,
          text: t.text,
        })),
      },
    })

    if (error || !data?.response) {
      throw new Error(error?.message || 'Empty response from interview AI gateway')
    }

    return {
      response: String(data.response),
      feedbackNote: data.feedback_note ? String(data.feedback_note) : undefined,
      isFinal: Boolean(data.is_final || params.questionNumber >= params.totalQuestions),
      suggestedTopic: data.suggested_topic ? String(data.suggested_topic) : undefined,
    }
  } catch (err) {
    console.warn('[MockInterview] Falling back to structured interview curriculum:', err)
    return getFallbackTurn(params.category, params.questionNumber, params.totalQuestions, params.candidateLastAnswer)
  }
}

function getFallbackTurn(
  category: InterviewCategory,
  questionNumber: number,
  totalQuestions: number,
  lastAnswer?: string
): { response: string; feedbackNote?: string; isFinal: boolean; suggestedTopic?: string } {
  const bank = STARTER_QUESTIONS[category] || STARTER_QUESTIONS.technical
  const idx = Math.min(questionNumber - 1, bank.length - 1)
  const isFinal = questionNumber >= totalQuestions

  if (questionNumber === 1) {
    return {
      response: `Welcome! I'll be your interviewer today. We'll go through ${totalQuestions} key questions to evaluate your readiness. Let's start: ${bank[0]}`,
      feedbackNote: 'Be concise, structured, and state your assumptions upfront.',
      isFinal: false,
      suggestedTopic: 'Foundations & Overview',
    }
  }

  if (isFinal) {
    return {
      response: `Thank you for sharing that answer! That wraps up our interview session today. You've answered all ${totalQuestions} questions. Give me just a moment while I compile your detailed evaluation report.`,
      feedbackNote: 'Great effort completing the full mock interview session.',
      isFinal: true,
      suggestedTopic: 'Wrap-up & Feedback',
    }
  }

  const nextQuestion = bank[idx] || "Could you summarize how you verify the correctness and time complexity of your solution?"
  const ack = lastAnswer && lastAnswer.length > 30
    ? "Thank you for that thorough explanation. Let's build on that with the next question: "
    : "Got it. Moving on to our next area: "

  return {
    response: `${ack}${nextQuestion}`,
    feedbackNote: 'Clear answer. Keep pacing steady and mention edge cases.',
    isFinal: false,
    suggestedTopic: `Core Competency #${questionNumber}`,
  }
}

// ─── AI Interview Evaluation ──────────────────────────────────────────────────
export async function evaluateInterview(params: {
  studentId?: string
  roleName: string
  category: InterviewCategory
  difficulty: InterviewDifficulty
  turns: InterviewTurn[]
}): Promise<InterviewEvaluation> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: {
        feature: 'mock_interview_evaluate',
        student_id: params.studentId,
        role_name: params.roleName,
        interview_type: params.category,
        difficulty: params.difficulty,
        transcript: params.turns.map(t => ({
          speaker: t.speaker,
          text: t.text,
        })),
      },
    })

    if (error || !data?.overall_score) {
      throw new Error(error?.message || 'Empty evaluation from AI gateway')
    }

    return {
      overall_score: Number(data.overall_score),
      technical_score: Number(data.technical_score || data.overall_score),
      communication_score: Number(data.communication_score || data.overall_score),
      confidence_score: Number(data.confidence_score || data.overall_score),
      verdict: data.verdict || 'Hire',
      summary: String(data.summary || 'Solid interview performance with clear communication.'),
      key_strengths: Array.isArray(data.key_strengths) ? data.key_strengths : ['Clear articulation of technical concepts', 'Good structured thinking'],
      areas_for_improvement: Array.isArray(data.areas_for_improvement) ? data.areas_for_improvement : ['Provide more quantitative examples', 'Explicitly mention time and space complexity'],
      question_evaluations: Array.isArray(data.question_evaluations) ? data.question_evaluations : [],
      recommended_topics: Array.isArray(data.recommended_topics) ? data.recommended_topics : ['System Design basics', 'Edge cases in algorithms'],
    }
  } catch (err) {
    console.warn('[MockInterview] Falling back to deterministic evaluation rubric:', err)
    return generateFallbackEvaluation(params.turns)
  }
}

function generateFallbackEvaluation(turns: InterviewTurn[]): InterviewEvaluation {
  const candidateTurns = turns.filter(t => t.speaker === 'candidate')
  const totalWords = candidateTurns.reduce((acc, t) => acc + t.text.split(/\s+/).filter(Boolean).length, 0)
  const avgWordsPerAnswer = candidateTurns.length > 0 ? totalWords / candidateTurns.length : 0

  let techScore = 75
  let commScore = 78
  let confScore = 80

  if (avgWordsPerAnswer > 40) {
    techScore += 10
    commScore += 8
    confScore += 6
  } else if (avgWordsPerAnswer < 15) {
    techScore -= 12
    commScore -= 10
  }

  const overall = Math.min(94, Math.max(58, Math.round((techScore + commScore + confScore) / 3)))
  const verdict: InterviewEvaluation['verdict'] = overall >= 85 ? 'Strong Hire' : overall >= 74 ? 'Hire' : overall >= 65 ? 'Lean Hire' : 'Needs Work'

  const qEvals: QuestionEvaluation[] = []
  let interviewerTurn = ''
  for (const t of turns) {
    if (t.speaker === 'interviewer') {
      interviewerTurn = t.text
    } else if (t.speaker === 'candidate' && interviewerTurn) {
      qEvals.push({
        question: interviewerTurn,
        candidate_answer: t.text.slice(0, 160) + (t.text.length > 160 ? '...' : ''),
        rating: t.text.length > 80 ? 'good' : 'average',
        feedback: t.text.length > 80
          ? 'Addressed the key points clearly. Recommend adding concrete trade-offs or big-O complexity.'
          : 'Answer was brief. Expand on reasoning and mention real-world applications.',
      })
      interviewerTurn = ''
    }
  }

  return {
    overall_score: overall,
    technical_score: techScore,
    communication_score: commScore,
    confidence_score: confScore,
    verdict,
    summary: `The candidate demonstrated good foundational knowledge with steady conversational pacing across ${candidateTurns.length} interview questions. Answers were structured well and focused on problem-solving.`,
    key_strengths: [
      'Articulated core algorithmic concepts with appropriate terminology',
      'Demonstrated prompt answers without excessive hesitation',
      'Maintained professional and polite interview demeanor'
    ],
    areas_for_improvement: [
      'Proactively state Time and Space Complexity before wrapping up answers',
      'Elaborate on edge cases (null inputs, scale, memory limits)',
      'Use the STAR method (Situation, Task, Action, Result) for behavioral questions'
    ],
    question_evaluations: qEvals,
    recommended_topics: [
      'High-concurrency data structures & synchronization',
      'Database index internal mechanisms (B+ trees vs Hash)',
      'System scalability patterns (caching, load balancing)'
    ]
  }
}

// ─── Persistence (Supabase + LocalStorage Fallback) ───────────────────────────
export async function saveInterviewSession(session: MockInterviewSession): Promise<void> {
  // Always save to localStorage immediately
  try {
    const existing: MockInterviewSession[] = loadLocalSessions()
    const updated = [session, ...existing.filter(s => s.id !== session.id)].slice(0, 25)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to write to localStorage:', e)
  }

  // Attempt to save to Supabase mock_interviews table
  try {
    await supabase.from('mock_interviews').upsert({
      id: session.id,
      student_id: session.studentId,
      role_name: session.roleName,
      interview_type: session.category,
      difficulty: session.difficulty,
      duration_seconds: session.durationSeconds,
      overall_score: session.evaluation?.overall_score ?? null,
      technical_score: session.evaluation?.technical_score ?? null,
      communication_score: session.evaluation?.communication_score ?? null,
      confidence_score: session.evaluation?.confidence_score ?? null,
      verdict: session.evaluation?.verdict ?? null,
      transcript_json: session.turns,
      evaluation_json: session.evaluation ?? {},
      created_at: session.createdAt,
    })
  } catch {
    // Graceful fallback if table is not yet created
  }
}

export function loadLocalSessions(): MockInterviewSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function loadPastInterviewSessions(studentId: string): Promise<MockInterviewSession[]> {
  try {
    const { data, error } = await supabase
      .from('mock_interviews')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!error && data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        studentId: d.student_id,
        roleName: d.role_name,
        category: d.interview_type,
        difficulty: d.difficulty,
        totalQuestions: (d.transcript_json?.filter((t: any) => t.speaker === 'interviewer') || []).length || 5,
        durationSeconds: d.duration_seconds || 0,
        turns: d.transcript_json || [],
        evaluation: d.evaluation_json && Object.keys(d.evaluation_json).length > 0 ? d.evaluation_json : undefined,
        status: 'completed',
        createdAt: d.created_at,
      }))
    }
  } catch {
    // fallback
  }
  return loadLocalSessions()
}

// ─── Web Speech Synthesis Helper (AI Voice Talking) ───────────────────────────
export class InterviewVoiceSpeaker {
  private synth: SpeechSynthesis | null = null
  private currentUtterance: SpeechSynthesisUtterance | null = null

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return []
    return this.synth.getVoices().filter(v => v.lang.startsWith('en'))
  }

  public speak(
    text: string,
    options?: {
      voiceName?: string
      rate?: number
      pitch?: number
      onStart?: () => void
      onEnd?: () => void
      onError?: () => void
    }
  ): void {
    if (!this.synth) {
      options?.onStart?.()
      setTimeout(() => options?.onEnd?.(), 1500)
      return
    }

    this.stop()

    const cleanText = text
      .replace(/[*_#`]/g, '')
      .replace(/\[.*?\]/g, '')
      .trim()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = options?.rate ?? 1.0
    utterance.pitch = options?.pitch ?? 1.0

    const voices = this.getAvailableVoices()
    if (options?.voiceName) {
      const match = voices.find(v => v.name === options.voiceName)
      if (match) utterance.voice = match
    } else {
      // Pick best natural voice if possible (Google US English, Samantha, Daniel, Victoria, etc.)
      const natural = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel'))
      if (natural) utterance.voice = natural
    }

    utterance.onstart = () => options?.onStart?.()
    utterance.onend = () => options?.onEnd?.()
    utterance.onerror = () => options?.onError?.()

    this.currentUtterance = utterance
    this.synth.speak(utterance)
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel()
    }
    this.currentUtterance = null
  }

  public isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false
  }
}
