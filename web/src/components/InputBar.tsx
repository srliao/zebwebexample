import { useState, useRef, type KeyboardEvent } from 'react'
import { useMudContext } from '../context/MudContext'
import { useCommandHistory } from '../hooks/useCommandHistory'

export default function InputBar() {
  const { status, sendCommand } = useMudContext()
  const [value, setValue] = useState('')
  const { history, push, getAt } = useCommandHistory()
  // cursor tracks position in history; -1 = not browsing
  const cursorRef = useRef(-1)
  // snapshot of current input before starting history nav
  const draftRef = useRef('')

  const isConnected = status === 'connected'

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const len = history.current.length
      if (len === 0) return
      if (cursorRef.current === -1) {
        draftRef.current = value
        cursorRef.current = len - 1
      } else if (cursorRef.current > 0) {
        cursorRef.current -= 1
      }
      setValue(getAt(cursorRef.current))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (cursorRef.current === -1) return
      const len = history.current.length
      if (cursorRef.current < len - 1) {
        cursorRef.current += 1
        setValue(getAt(cursorRef.current))
      } else {
        cursorRef.current = -1
        setValue(draftRef.current)
      }
    } else if (e.key === 'Enter') {
      const cmd = value.trim()
      if (cmd) {
        sendCommand(cmd)
        push(cmd)
      }
      setValue('')
      cursorRef.current = -1
      draftRef.current = ''
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
    // If user types while browsing history, reset cursor
    cursorRef.current = -1
  }

  return (
    <div className="input-bar">
      <span className="input-bar__prompt">&gt;</span>
      <input
        className="input-bar__input"
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={!isConnected}
        placeholder={isConnected ? 'Type a command…' : 'Not connected'}
        autoFocus
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}
