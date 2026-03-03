import { useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { ConnectionStatus, MudAddon } from '../types'

// Strips ANSI escape sequences from text
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[^[\]]/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '')
}

function buildWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL as string
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws`
}

export function useMud(
  termRef: RefObject<XTerm | null>,
  _fitAddonRef: RefObject<FitAddon | null>,
  addons: MudAddon[],
) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionLog, setSessionLog] = useState('')
  const [connectGeneration, setConnectGeneration] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const decoder = useRef(new TextDecoder())
  // Buffer for accumulating partial lines for addon onData callbacks
  const lineBuffer = useRef('')

  const reconnect = useCallback(() => {
    setConnectGeneration((g) => g + 1)
  }, [])

  const sendCommand = useCallback((cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd + '\r\n')
    }
  }, [])

  useEffect(() => {
    const url = buildWsUrl()
    setStatus('connecting')

    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      addons.forEach((a) => a.onConnect?.())
    }

    ws.onclose = () => {
      setStatus('disconnected')
      addons.forEach((a) => a.onDisconnect?.())
    }

    ws.onerror = () => {
      setStatus('error')
    }

    ws.onmessage = (evt: MessageEvent) => {
      let text: string
      if (evt.data instanceof ArrayBuffer) {
        text = decoder.current.decode(evt.data, { stream: true })
      } else {
        text = evt.data as string
      }

      // Write raw data (with ANSI) to terminal
      termRef.current?.write(text)

      // Accumulate plain text for session log and addon onData
      const plain = stripAnsi(text)
      setSessionLog((prev) => prev + plain)

      // Dispatch complete lines to addons
      lineBuffer.current += plain
      const lines = lineBuffer.current.split('\n')
      lineBuffer.current = lines.pop() ?? ''
      if (lines.length > 0 && addons.some((a) => a.onData)) {
        for (const line of lines) {
          addons.forEach((a) => a.onData?.(line))
        }
      }
    }

    return () => {
      ws.onopen = null
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      wsRef.current = null
      setStatus('disconnected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectGeneration])

  return { status, sessionLog, sendCommand, reconnect }
}
