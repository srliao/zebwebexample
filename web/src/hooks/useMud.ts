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

// ── Telnet IAC constants ───────────────────────────────────────────────────
const IAC  = 0xff
const WILL = 0xfb
const DO   = 0xfd
const SB   = 0xfa
const SE   = 0xf0
const GMCP = 0xc9  // 201

function negotiateGmcp(ws: WebSocket) {
  // IAC DO GMCP
  ws.send(new Uint8Array([IAC, DO, GMCP]).buffer)

  // IAC SB GMCP Core.Supports.Set [...] IAC SE
  const supports = 'Core.Supports.Set ["room 1", "room.info 1", "char 1", "char.vitals 1"]'
  const enc = new TextEncoder().encode(supports)
  const pkt = new Uint8Array(3 + enc.length + 2)
  pkt[0] = IAC; pkt[1] = SB; pkt[2] = GMCP
  pkt.set(enc, 3)
  pkt[3 + enc.length]     = IAC
  pkt[3 + enc.length + 1] = SE
  ws.send(pkt.buffer)

  console.log('[mud:gmcp] Sent IAC DO GMCP + Core.Supports.Set')
}

interface ParseResult {
  cleanBytes: Uint8Array
  gmcpMessages: string[]
  hasIAC: boolean
  // Non-null when a GMCP block started but IAC SE hasn't arrived yet.
  // Caller should prepend this to the next incoming message.
  gmcpLeftover: Uint8Array | null
}

function parseTelnet(bytes: Uint8Array, ws: WebSocket): ParseResult {
  const clean: number[] = []
  const gmcpMessages: string[] = []
  let hasIAC = false
  let gmcpLeftover: Uint8Array | null = null
  let i = 0

  while (i < bytes.length) {
    if (bytes[i] !== IAC) {
      clean.push(bytes[i++])
      continue
    }

    hasIAC = true

    if (i + 1 >= bytes.length) {
      // Lone IAC at the very end — drop it
      break
    }

    const cmd = bytes[i + 1]

    // ── IAC WILL GMCP ─────────────────────────────────────────────────────
    if (cmd === WILL && i + 2 < bytes.length && bytes[i + 2] === GMCP) {
      console.log('[mud:iac] IAC WILL GMCP — negotiating GMCP')
      negotiateGmcp(ws)
      i += 3
      continue
    }

    // ── IAC SB GMCP <data> IAC SE ─────────────────────────────────────────
    if (cmd === SB && i + 2 < bytes.length && bytes[i + 2] === GMCP) {
      const blockStart = i    // saved in case block is incomplete
      const dataStart  = i + 3

      // Scan forward for the IAC SE terminator
      let j = dataStart
      while (j < bytes.length - 1 && !(bytes[j] === IAC && bytes[j + 1] === SE)) {
        j++
      }

      if (bytes[j] === IAC && bytes[j + 1] === SE) {
        // Complete block — extract and dispatch
        const payload = new TextDecoder().decode(bytes.slice(dataStart, j))
        gmcpMessages.push(payload)
        console.log('[mud:iac] GMCP payload:', payload)
        i = j + 2
      } else {
        // Block is split across WS messages — buffer from blockStart and stop.
        // Everything after the IAC SB GMCP is held; we do NOT write it to xterm.
        gmcpLeftover = bytes.slice(blockStart)
        console.log('[mud:iac] Incomplete GMCP block — buffering for next message')
        break
      }
      continue
    }

    // ── IAC SB <other> — skip entire sub-negotiation ──────────────────────
    if (cmd === SB) {
      i += 2
      while (i < bytes.length - 1 && !(bytes[i] === IAC && bytes[i + 1] === SE)) i++
      if (i < bytes.length - 1) i += 2
      continue
    }

    // ── IAC WILL / WONT / DO / DONT <option> — 3-byte ────────────────────
    if (cmd >= 0xfb && cmd <= 0xfe) {
      const hex = `ff ${cmd.toString(16).padStart(2, '0')} ${(bytes[i + 2] ?? 0).toString(16).padStart(2, '0')}`
      console.log(`[mud:iac] 3-byte: ${hex}`)
      i += 3
      continue
    }

    // ── IAC <cmd> — 2-byte ────────────────────────────────────────────────
    const hex = `ff ${cmd.toString(16).padStart(2, '0')}`
    console.log(`[mud:iac] 2-byte: ${hex}`)
    i += 2
  }

  return { cleanBytes: new Uint8Array(clean), gmcpMessages, hasIAC, gmcpLeftover }
}

// Concat two Uint8Arrays into a new ArrayBuffer-backed Uint8Array
function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

export function useMud(
  termRef: RefObject<XTerm | null>,
  _fitAddonRef: RefObject<FitAddon | null>,
  addons: MudAddon[],
) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionLog, setSessionLog] = useState('')
  const [connectGeneration, setConnectGeneration] = useState(0)

  const wsRef        = useRef<WebSocket | null>(null)
  const decoder      = useRef(new TextDecoder())
  const lineBuffer   = useRef('')
  // Bytes from an incomplete IAC SB GMCP block waiting for IAC SE
  const gmcpLeftover = useRef<Uint8Array | null>(null)

  // Always-fresh ref so onmessage doesn't capture a stale addons list
  const addonsRef = useRef(addons)
  addonsRef.current = addons

  const reconnect = useCallback(() => {
    setConnectGeneration((g) => g + 1)
  }, [])

  const sendCommand = useCallback((cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd + '\r\n')
    }
  }, [])

  useEffect(() => {
    if (connectGeneration === 0) return

    const url = buildWsUrl()
    setStatus('connecting')

    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      addonsRef.current.forEach((a) => a.onConnect?.())
    }

    ws.onclose = () => {
      setStatus('disconnected')
      addonsRef.current.forEach((a) => a.onDisconnect?.())
      gmcpLeftover.current = null
    }

    ws.onerror = () => {
      setStatus('error')
    }

    ws.onmessage = (evt: MessageEvent) => {
      let textForTerminal: string
      let gmcpMessages: string[] = []

      if (evt.data instanceof ArrayBuffer) {
        let raw = new Uint8Array(evt.data)

        // If we have buffered bytes from a split GMCP block, prepend them
        if (gmcpLeftover.current) {
          raw = concat(gmcpLeftover.current, raw)
          gmcpLeftover.current = null
        }

        if (raw.indexOf(IAC) !== -1) {
          const result = parseTelnet(raw, ws)
          gmcpLeftover.current = result.gmcpLeftover
          gmcpMessages = result.gmcpMessages
          textForTerminal = decoder.current.decode(result.cleanBytes, { stream: true })
        } else {
          textForTerminal = decoder.current.decode(raw, { stream: true })
        }
      } else {
        textForTerminal = evt.data as string
      }

      // Write IAC-clean text to xterm
      termRef.current?.write(textForTerminal)

      // Accumulate plain text for session log
      const plain = stripAnsi(textForTerminal)
      setSessionLog((prev) => prev + plain)

      const currentAddons = addonsRef.current

      // Dispatch completed GMCP payloads to addons directly (not line-buffered)
      for (const msg of gmcpMessages) {
        currentAddons.forEach((a) => a.onData?.(msg))
      }

      // Dispatch complete plain-text lines to addons
      lineBuffer.current += plain
      const lines = lineBuffer.current.split('\n')
      lineBuffer.current = lines.pop() ?? ''
      if (lines.length > 0 && currentAddons.some((a) => a.onData)) {
        for (const line of lines) {
          currentAddons.forEach((a) => a.onData?.(line))
        }
      }
    }

    return () => {
      ws.onopen    = null
      ws.onclose   = null
      ws.onerror   = null
      ws.onmessage = null
      ws.close()
      wsRef.current = null
      gmcpLeftover.current = null
      setStatus('disconnected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectGeneration])

  return { status, sessionLog, sendCommand, reconnect, hasConnected: connectGeneration > 0 }
}
