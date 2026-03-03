import { useRef, type MutableRefObject } from 'react'

export interface CommandHistory {
  history: MutableRefObject<string[]>
  push: (cmd: string) => void
  getAt: (idx: number) => string
}

// cursorRef is managed by InputBar for synchronous arrow-key reads
export function useCommandHistory() {
  const history = useRef<string[]>([])

  function push(cmd: string) {
    if (cmd && history.current[history.current.length - 1] !== cmd) {
      history.current = [...history.current, cmd]
    }
  }

  function getAt(idx: number): string {
    return history.current[idx] ?? ''
  }

  return { history, push, getAt }
}
