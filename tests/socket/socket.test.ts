import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'

class MockSocket extends EventEmitter {
  id: string
  handshake = { headers: { origin: 'http://localhost' } }
  joinedRooms = new Set<string>()

  constructor(id: string) {
    super()
    this.id = id
  }

  join(roomId: string) {
    this.joinedRooms.add(roomId)
  }
}

class MockIo extends EventEmitter {
  emitted: Array<{ roomId: string; event: string; payload: any }> = []
  private connectionHandler?: (socket: MockSocket) => void

  override on(eventName: string | symbol, listener: (...args: any[]) => void) {
    super.on(eventName, listener)
    if (eventName === 'connection') {
      this.connectionHandler = listener as (socket: MockSocket) => void
    }
    return this
  }

  to(roomId: string) {
    return {
      emit: (event: string, payload: any) => {
        this.emitted.push({ roomId, event, payload })
      }
    }
  }

  connect(socket: MockSocket) {
    this.connectionHandler?.(socket)
  }

  pop(roomId: string, event: string) {
    return this.emitted.filter(entry => entry.roomId === roomId && entry.event === event)
  }

  clear() {
    this.emitted = []
  }
}

describe('Socket recording flow', () => {
  const roomId = 'room-1'
  const userId = 'user-1'
  const userName = 'Alex'
  let io: MockIo
  let socket: MockSocket
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.resetModules()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const socketModule = await import('@/lib/socket')
    io = new MockIo()
    socketModule.setupSocket(io as any)
    socket = new MockSocket('socket-1')
    io.connect(socket)
    io.clear()
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('registers participants when joining a room', () => {
    socket.emit('join-room', { roomId, userId, userName })

    expect(socket.joinedRooms.has(roomId)).toBe(true)
    const updates = io.pop(roomId, 'participants-updated')
    expect(updates).toHaveLength(1)
    expect(updates[0].payload).toEqual([
      {
        userId,
        userName,
        socketId: socket.id,
        isRecording: false
      }
    ])
  })

  it('marks the participant as recording when started', () => {
    socket.emit('join-room', { roomId, userId, userName })
    io.clear()

    socket.emit('recording-started', { roomId, userId })

    const startEvents = io.pop(roomId, 'recording-started')
    expect(startEvents).toHaveLength(1)
    expect(startEvents[0].payload).toEqual({ userId })

    const participantUpdates = io.pop(roomId, 'participants-updated')
    expect(participantUpdates).toHaveLength(1)
    expect(participantUpdates[0].payload[0].isRecording).toBe(true)
  })

  it('clears the recording flag when stopped', () => {
    socket.emit('join-room', { roomId, userId, userName })
    socket.emit('recording-started', { roomId, userId })
    io.clear()

    socket.emit('recording-stopped', { roomId, userId })

    const stopEvents = io.pop(roomId, 'recording-stopped')
    expect(stopEvents).toHaveLength(1)
    expect(stopEvents[0].payload).toEqual({ userId })

    const participantUpdates = io.pop(roomId, 'participants-updated')
    expect(participantUpdates).toHaveLength(1)
    expect(participantUpdates[0].payload[0].isRecording).toBe(false)
  })

  it('removes the participant on disconnect', () => {
    socket.emit('join-room', { roomId, userId, userName })
    io.clear()

    socket.emit('disconnect', 'client namespace disconnect')

    const participantUpdates = io.pop(roomId, 'participants-updated')
    expect(participantUpdates).toHaveLength(1)
    expect(participantUpdates[0].payload).toEqual([])
  })

  it('prevents duplicate participants for repeated joins', () => {
    socket.emit('join-room', { roomId, userId, userName })
    io.clear()

    socket.emit('join-room', { roomId, userId, userName })

    const participantUpdates = io.pop(roomId, 'participants-updated')
    expect(participantUpdates).toHaveLength(1)
    expect(participantUpdates[0].payload).toHaveLength(1)
  })
})
