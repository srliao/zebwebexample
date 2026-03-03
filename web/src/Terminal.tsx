import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useMudContext } from './context/MudContext'

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { termRef, fitAddonRef, fontSize } = useMudContext()

  useEffect(() => {
    const term = new XTerm({
      disableStdin: true,
      cursorBlink: false,
      fontSize,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current!)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Defer fit until after browser has completed layout
    const rafId = requestAnimationFrame(() => fitAddon.fit())

    const onResize = () => fitAddon.fit()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      termRef.current = null
      fitAddonRef.current = null
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="terminal-container" ref={containerRef} />
}
