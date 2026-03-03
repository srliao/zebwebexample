import { useState, useEffect, useRef, useCallback } from 'react'
import { useMudContext } from '../../context/MudContext'
import type { MudAddonProps } from '../../types'

interface ShoutMessage {
  time: string
  speaker: string
  text: string
  type: 'shout' | 'gossip' | 'chat' | 'self'
}

// [regex, type, isSelf] — matches common MUD communication channels
const PATTERNS: Array<[RegExp, ShoutMessage['type']]> = [
  [/^You shout[s]?:?\s+(.+)/i, 'self'],
  [/^(\w+) shouts?:?\s+(.+)/i, 'shout'],
  [/^You gossip[s]?:?\s+(.+)/i, 'self'],
  [/^(\w+) gossips?:?\s+(.+)/i, 'gossip'],
  [/^You chat[s]?:?\s+(.+)/i, 'self'],
  [/^(\w+) chats?:?\s+(.+)/i, 'chat'],
]

function matchLine(line: string): ShoutMessage | null {
  const time = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })

  for (const [re, type] of PATTERNS) {
    const m = line.match(re)
    if (!m) continue
    if (type === 'self') {
      return { time, speaker: 'You', text: m[1], type }
    }
    return { time, speaker: m[1], text: m[2], type }
  }
  return null
}

const TYPE_COLORS: Record<ShoutMessage['type'], string> = {
  shout: '#f87171',
  gossip: '#a78bfa',
  chat: '#34d399',
  self: '#60a5fa',
}

export default function ShoutAddon({ sendCommand }: MudAddonProps) {
  const { registerAddon, unregisterAddon } = useMudContext()
  const [messages, setMessages] = useState<ShoutMessage[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const onDataRef = useRef<(line: string) => void>(() => {})
  onDataRef.current = (line: string) => {
    const msg = matchLine(line)
    if (msg) {
      setMessages((prev) => [...prev.slice(-199), msg])
    }
  }

  useEffect(() => {
    registerAddon({
      id: 'shout',
      name: 'Shout',
      component: ShoutAddon,
      onData: (line) => onDataRef.current(line),
    })
    return () => unregisterAddon('shout')
  }, [registerAddon, unregisterAddon])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSend = useCallback(() => {
    const cmd = input.trim()
    if (!cmd) return
    sendCommand(`shout ${cmd}`)
    setInput('')
  }, [input, sendCommand])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSend()
        e.stopPropagation()
        e.preventDefault()
      }
    },
    [handleSend],
  )

  return (
    <div className="shout-addon">
      <div className="addon-header">
        <span className="addon-header__title">Shout</span>
      </div>

      <div className="shout-addon__messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="addon-empty">No shouts yet…</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="shout-msg">
              <span className="shout-msg__time">{msg.time}</span>
              <span
                className="shout-msg__speaker"
                style={{ color: TYPE_COLORS[msg.type] }}
              >
                {msg.speaker}
              </span>
              <span className="shout-msg__text">{msg.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="shout-addon__input-row">
        <input
          className="shout-addon__input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="shout…"
        />
        <button className="shout-addon__btn" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  )
}
