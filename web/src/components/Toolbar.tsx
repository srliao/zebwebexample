import { useMudContext } from '../context/MudContext'
import type { ConnectionStatus } from '../types'

function statusLabel(s: ConnectionStatus): string {
  switch (s) {
    case 'connected': return 'Connected'
    case 'connecting': return 'Connecting…'
    case 'disconnected': return 'Disconnected'
    case 'error': return 'Error'
  }
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" />
      {statusLabel(status)}
    </span>
  )
}

export default function Toolbar() {
  const { status, sessionLog, fontSize, setFontSize } = useMudContext()

  function downloadLog() {
    const blob = new Blob([sessionLog], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mud-session-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="toolbar">
      <StatusBadge status={status} />
      <div className="toolbar__spacer" />
      <div className="toolbar__group">
        <button
          className="toolbar__btn"
          onClick={() => setFontSize(fontSize - 1)}
          title="Decrease font size"
          aria-label="Decrease font size"
        >
          A-
        </button>
        <span className="toolbar__font-size">{fontSize}px</span>
        <button
          className="toolbar__btn"
          onClick={() => setFontSize(fontSize + 1)}
          title="Increase font size"
          aria-label="Increase font size"
        >
          A+
        </button>
      </div>
      <div className="toolbar__group">
        <button
          className="toolbar__btn"
          onClick={downloadLog}
          disabled={!sessionLog}
          title="Download session log"
        >
          Download Log
        </button>
      </div>
    </div>
  )
}
