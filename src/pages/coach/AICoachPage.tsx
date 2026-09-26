/**
 * AI Coach Page (P3-6)
 * Chat UI — persists across refresh, intent classification, before/after confirmation.
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { LoadingPage } from '../../components/ui/Loading'
import {
  getOrCreateChat, loadMessages, saveMessage,
  sendToCoach, buildStudentContext,
  type ChatMessage, type ChatSession,
} from '../../features/coach/coachService'
import {
  buildPreview, executePatch, loadRecentPatches,
  type PatchPreview, type PatchRecord,
} from '../../features/coach/patchService'
import type { ProposedPatch } from '../../config/aiFeatures'
import { Send, BotMessageSquare, RotateCcw, CheckCircle, XCircle, History } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
export function AICoachPage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()

  const [loading, setLoading] = useState(true)
  const [chat, setChat] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [studentCtx, setStudentCtx] = useState<Record<string, unknown>>({})

  // Confirmation state
  const [pendingPatch, setPendingPatch] = useState<ProposedPatch | null>(null)
  const [patchPreview, setPatchPreview] = useState<PatchPreview | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // History
  const [showHistory, setShowHistory] = useState(false)
  const [recentPatches, setRecentPatches] = useState<PatchRecord[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!appUser) return
    init()
  }, [appUser])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function init() {
    setLoading(true)
    const uid = appUser!.auth.id
    const [session, ctx] = await Promise.all([
      getOrCreateChat(uid),
      buildStudentContext(uid),
    ])
    setChat(session)
    setStudentCtx(ctx)
    const msgs = await loadMessages(session.id)
    setMessages(msgs)
    if (msgs.length === 0) {
      // Greet with a deterministic welcome (no Gemini call)
      const welcome: ChatMessage = {
        id: 'welcome',
        sender: 'assistant',
        content: `Hello! I'm your AI Coach. I can help you understand where you stand, plan your study sessions, adjust your roadmap, and answer preparation questions.\n\nWhat would you like to do today?`,
        created_at: new Date().toISOString(),
      }
      setMessages([welcome])
    }
    setLoading(false)
  }

  async function handleSend() {
    if (!input.trim() || sending || !chat || !appUser) return
    const text = input.trim()
    setInput('')

    // Save user message
    const userMsg = await saveMessage(chat.id, appUser.auth.id, 'user', text)
    setMessages(prev => [...prev, userMsg])
    setSending(true)

    try {
      const { reply, coachResponse } = await sendToCoach(
        appUser.auth.id, chat.id, text, messages, studentCtx,
      )
      setMessages(prev => [...prev, reply])

      // If db_change — build preview
      if (coachResponse.requires_confirmation && coachResponse.proposed_patch) {
        setPendingPatch(coachResponse.proposed_patch)
        const preview = await buildPreview(appUser.auth.id, coachResponse.proposed_patch)
        setPatchPreview(preview)
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Coach failed to respond.')
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  async function handleConfirm() {
    if (!pendingPatch || !patchPreview || !appUser || !chat) return
    setConfirmLoading(true)
    try {
      const result = await executePatch(appUser.auth.id, chat.id, pendingPatch, patchPreview)
      if (result.success) {
        success('Changes applied!')
        const confirmMsg: ChatMessage = {
          id: `confirm-${Date.now()}`,
          sender: 'assistant',
          content: `✅ Done! ${pendingPatch.summary}`,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, confirmMsg])
      } else {
        toastError(result.error ?? 'Failed to apply changes.')
      }
    } finally {
      setPendingPatch(null)
      setPatchPreview(null)
      setConfirmLoading(false)
    }
  }

  async function handleLoadHistory() {
    if (!appUser) return
    setShowHistory(h => !h)
    if (!showHistory) {
      const patches = await loadRecentPatches(appUser.auth.id)
      setRecentPatches(patches)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="coach-layout">
      {/* ── Header ── */}
      <div className="coach-header">
        <div className="coach-header__brand">
          <BotMessageSquare size={20} color="var(--color-accent-500)" />
          <span className="coach-header__title">AI Coach</span>
        </div>
        <div className="coach-header__actions">
          <button className="coach-history-btn" onClick={handleLoadHistory} title="Change history">
            <History size={16} />
            <span>History</span>
          </button>
        </div>
      </div>

      <div className="coach-body">
        {/* ── Chat area ── */}
        <div className="coach-messages">
          {messages.map((msg, idx) => (
            <ChatBubble key={msg.id ?? idx} msg={msg} />
          ))}

          {sending && (
            <div className="chat-bubble chat-bubble--assistant">
              <div className="chat-bubble__typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* ── Confirmation card ── */}
          {pendingPatch && patchPreview && (
            <ConfirmationCard
              preview={patchPreview}
              loading={confirmLoading}
              onConfirm={handleConfirm}
              onCancel={() => { setPendingPatch(null); setPatchPreview(null) }}
            />
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Change history panel ── */}
        {showHistory && (
          <div className="coach-history-panel">
            <div className="coach-history-panel__title">Recent Changes</div>
            {recentPatches.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-4)' }}>No confirmed changes yet.</p>
            )}
            {recentPatches.map(p => (
              <div key={p.id} className="coach-history-item">
                <div className="coach-history-item__summary">{p.summary}</div>
                <div className="coach-history-item__meta">
                  {new Date(p.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Input bar ── */}
        <div className="coach-input-bar">
          <textarea
            ref={textareaRef}
            className="coach-input-bar__textarea"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your preparation… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={sending}
            id="coach-input"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            loading={sending}
            id="coach-send-btn"
            style={{ alignSelf: 'flex-end', flexShrink: 0 }}
          >
            <Send size={15} />
            Send
          </Button>
        </div>

        {/* Quick prompts */}
        <div className="coach-quick-prompts">
          {[
            'What should I study today?',
            'Where am I weakest?',
            'I finished DSA today.',
            'Give me a lighter plan today.',
          ].map(p => (
            <button key={p} className="coach-quick-prompt" onClick={() => setInput(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.sender === 'user'
  return (
    <div className={`chat-bubble chat-bubble--${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="chat-bubble__avatar">
          <BotMessageSquare size={14} color="var(--color-accent-500)" />
        </div>
      )}
      <div className="chat-bubble__body">
        {msg.content.split('\n').map((line, i) => (
          <span key={i}>{line}{i < msg.content.split('\n').length - 1 ? <br /> : null}</span>
        ))}
        <div className="chat-bubble__time">
          {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

// ─── Confirmation Card ────────────────────────────────────────────────────────
function ConfirmationCard({
  preview, loading, onConfirm, onCancel,
}: {
  preview: PatchPreview
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="confirm-card">
      <div className="confirm-card__header">
        <span className="confirm-card__title">Proposed Change</span>
        <span className="confirm-card__summary">{preview.summary}</span>
      </div>

      <div className="confirm-card__diff">
        <div className="confirm-card__col confirm-card__col--before">
          <div className="confirm-card__col-label">Before</div>
          {preview.before.map((item, i) => (
            <div key={i} className="confirm-card__row confirm-card__row--before">
              {renderPreviewItem(item)}
            </div>
          ))}
          {preview.before.length === 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>}
        </div>
        <div className="confirm-card__col confirm-card__col--after">
          <div className="confirm-card__col-label">After</div>
          {preview.after.map((item, i) => (
            <div key={i} className="confirm-card__row confirm-card__row--after">
              {renderPreviewItem(item)}
            </div>
          ))}
          {preview.after.length === 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>}
        </div>
      </div>

      <div className="confirm-card__actions">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
          <XCircle size={14} /> Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} loading={loading} id="confirm-patch-btn">
          <CheckCircle size={14} /> Confirm Changes
        </Button>
      </div>
    </div>
  )
}

function renderPreviewItem(item: Record<string, unknown>): React.ReactNode {
  const type = item.type as string
  if (type === 'task' || type === 'task_move') {
    return <span style={{ fontSize: 'var(--text-sm)' }}>{String(item.title ?? '')} — <em>{String(item.status ?? item.from ?? item.to ?? '')}</em></span>
  }
  if (type === 'roadmap') {
    return <span style={{ fontSize: 'var(--text-sm)' }}>{String(item.name ?? '')} → <em>{String(item.status ?? '')}</em></span>
  }
  return <span style={{ fontSize: 'var(--text-sm)' }}>{JSON.stringify(item)}</span>
}
