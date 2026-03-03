import type React from 'react'
import type { MutableRefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface MudAddonProps {
  sendCommand: (cmd: string) => void
}

export interface MudAddon {
  id: string
  name: string
  panelPosition?: 'sidebar-right' | 'bottom' | 'float'
  component: React.ComponentType<MudAddonProps>
  onConnect?: () => void
  onDisconnect?: () => void
  onData?: (line: string) => void
}

export interface MudContextValue {
  // Refs populated by Terminal.tsx
  termRef: MutableRefObject<XTerm | null>
  fitAddonRef: MutableRefObject<FitAddon | null>
  // Connection
  status: ConnectionStatus
  hasConnected: boolean
  sessionLog: string
  sendCommand: (cmd: string) => void
  reconnect: () => void
  // Display
  fontSize: number
  setFontSize: (size: number) => void
  // Addons
  addons: MudAddon[]
  registerAddon: (addon: MudAddon) => void
  unregisterAddon: (id: string) => void
}
