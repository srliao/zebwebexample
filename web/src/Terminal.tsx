import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { AttachAddon } from '@xterm/addon-attach'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

function buildWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws`
}

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current!)
    fitAddon.fit()

    const ws = new WebSocket(buildWsUrl())
    ws.binaryType = 'arraybuffer'

    const attachAddon = new AttachAddon(ws)
    term.loadAddon(attachAddon)

    const onResize = () => fitAddon.fit()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      ws.close()
      term.dispose()
    }
  }, [])

  return <div className="terminal-container" ref={containerRef} />
}
