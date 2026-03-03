import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import { useMud } from '../hooks/useMud'
import type { MudAddon, MudContextValue } from '../types'

const MudContext = createContext<MudContextValue | null>(null)

const FONT_MIN = 8
const FONT_MAX = 32
const FONT_DEFAULT = 14

export function MudProvider({ children }: { children: ReactNode }) {
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  const [fontSize, setFontSizeState] = useState(FONT_DEFAULT)
  const [addons, setAddons] = useState<MudAddon[]>([])

  const setFontSize = useCallback((size: number) => {
    const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, size))
    setFontSizeState(clamped)
    if (termRef.current) {
      termRef.current.options.fontSize = clamped
    }
    // Use rAF to let xterm re-render before fitting
    requestAnimationFrame(() => {
      fitAddonRef.current?.fit()
    })
  }, [])

  const registerAddon = useCallback((addon: MudAddon) => {
    setAddons((prev) => {
      if (prev.find((a) => a.id === addon.id)) return prev
      return [...prev, addon]
    })
  }, [])

  const unregisterAddon = useCallback((id: string) => {
    setAddons((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const { status, sessionLog, sendCommand, reconnect } = useMud(termRef, fitAddonRef, addons)

  const value: MudContextValue = {
    termRef,
    fitAddonRef,
    status,
    sessionLog,
    sendCommand,
    reconnect,
    fontSize,
    setFontSize,
    addons,
    registerAddon,
    unregisterAddon,
  }

  return (
    <MudContext.Provider value={value}>
      {children}
    </MudContext.Provider>
  )
}

export function useMudContext(): MudContextValue {
  const ctx = useContext(MudContext)
  if (!ctx) throw new Error('useMudContext must be used inside MudProvider')
  return ctx
}
