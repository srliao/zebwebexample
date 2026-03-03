import { useState, useEffect, useRef } from 'react'
import { useMudContext } from '../../context/MudContext'
import type { MudAddonProps } from '../../types'

interface Room {
  id: string
  name: string
  area: string
  exits: Record<string, string> // dir -> roomId
  x: number
  y: number
}

const DIST = 52
const ROOM_R = 9

const DIR_OFFSET: Record<string, [number, number]> = {
  n:  [0, -DIST],
  s:  [0, +DIST],
  e:  [+DIST, 0],
  w:  [-DIST, 0],
  ne: [+DIST, -DIST],
  nw: [-DIST, -DIST],
  se: [+DIST, +DIST],
  sw: [-DIST, +DIST],
  u:  [+Math.round(DIST / 3), -Math.round(DIST / 3)],
  d:  [-Math.round(DIST / 3), +Math.round(DIST / 3)],
}

export default function MapperAddon(_props: MudAddonProps) {
  const { registerAddon, unregisterAddon } = useMudContext()
  const roomsRef = useRef<Map<string, Room>>(new Map())
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [roomCount, setRoomCount] = useState(0)

  // Always-fresh onData via ref to avoid stale closure issues
  const onDataRef = useRef<(line: string) => void>(() => {})
  onDataRef.current = (line: string) => {
    if (!line.startsWith('room.info ')) return
    try {
      // GMCP uses `num` (number) for room ID and `zone` for area name.
      // Exit values are also numbers, not strings.
      const raw = JSON.parse(line.slice('room.info '.length)) as {
        num: number
        name: string
        zone?: string
        exits?: Record<string, number>
      }

      // Normalise everything to strings for consistent Map keying
      const id = String(raw.num)
      const exits: Record<string, string> = {}
      for (const [dir, targetNum] of Object.entries(raw.exits ?? {})) {
        exits[dir] = String(targetNum)
      }

      const rooms = roomsRef.current

      if (!rooms.has(id)) {
        // Calculate position by finding a known neighbour that has an exit to this room
        let x = 0
        let y = 0
        let placed = false

        for (const room of rooms.values()) {
          for (const [dir, targetId] of Object.entries(room.exits)) {
            if (targetId === id && DIR_OFFSET[dir]) {
              const [dx, dy] = DIR_OFFSET[dir]
              x = room.x + dx
              y = room.y + dy
              placed = true
              break
            }
          }
          if (placed) break
        }

        rooms.set(id, {
          id,
          name: raw.name,
          area: raw.zone ?? '',
          exits,
          x,
          y,
        })
        setRoomCount(rooms.size)
      } else {
        // Update exits for an already-known room (they may have changed or been partial)
        const existing = rooms.get(id)!
        existing.exits = exits
      }

      setCurrentRoomId(id)
    } catch {
      // ignore parse errors
    }
  }

  useEffect(() => {
    registerAddon({
      id: 'mapper',
      name: 'Mapper',
      component: MapperAddon,
      onData: (line) => onDataRef.current(line),
    })
    return () => unregisterAddon('mapper')
  }, [registerAddon, unregisterAddon])

  const rooms = roomsRef.current
  const currentRoom = currentRoomId ? rooms.get(currentRoomId) : null
  const roomList = Array.from(rooms.values())

  // Exit lines between known rooms
  const exitLines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = []
  const seen = new Set<string>()
  for (const room of roomList) {
    for (const [, targetId] of Object.entries(room.exits)) {
      const target = rooms.get(targetId)
      if (!target) continue
      const key = [room.id, targetId].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      exitLines.push({ key, x1: room.x, y1: room.y, x2: target.x, y2: target.y })
    }
  }

  // ViewBox centered on current room
  const VIEW_W = 280
  const VIEW_H = 220
  const cx = currentRoom ? currentRoom.x : 0
  const cy = currentRoom ? currentRoom.y : 0
  const viewBox = `${cx - VIEW_W / 2} ${cy - VIEW_H / 2} ${VIEW_W} ${VIEW_H}`

  return (
    <div className="mapper-addon">
      <div className="addon-header">
        <span className="addon-header__title">Mapper</span>
        {currentRoom && (
          <span className="addon-header__info">
            {currentRoom.area || '—'}
          </span>
        )}
      </div>

      <div className="mapper-addon__canvas">
        {roomCount === 0 ? (
          <div className="addon-empty">Waiting for room data…</div>
        ) : (
          <svg width="100%" height="100%" viewBox={viewBox} className="mapper-addon__svg">
            {/* Exit lines */}
            {exitLines.map((l) => (
              <line
                key={l.key}
                x1={l.x1} y1={l.y1}
                x2={l.x2} y2={l.y2}
                stroke="#4a5568"
                strokeWidth="1.5"
              />
            ))}

            {/* Rooms */}
            {roomList.map((room) => {
              const isCurrent = room.id === currentRoomId
              return (
                <g key={room.id} transform={`translate(${room.x},${room.y})`}>
                  <circle
                    r={ROOM_R}
                    fill={isCurrent ? '#2563eb' : '#1e2433'}
                    stroke={isCurrent ? '#60a5fa' : '#4a5568'}
                    strokeWidth={isCurrent ? 2 : 1.5}
                  />
                  {isCurrent && (
                    <circle r={ROOM_R + 4} fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.4" />
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <div className="mapper-addon__footer">
        {currentRoom ? (
          <span className="mapper-addon__room-name">{currentRoom.name}</span>
        ) : (
          <span className="mapper-addon__room-name mapper-addon__room-name--empty">No location</span>
        )}
        <span className="mapper-addon__count">{roomCount} rooms</span>
      </div>
    </div>
  )
}
