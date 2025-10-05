/** @vitest-environment jsdom */
import React from 'react'
import { render, waitFor, screen } from '@testing-library/react'
import RoomPage from '@/app/room/[id]/page'
import { describe, it, beforeAll, afterAll, beforeEach, afterEach, vi, expect } from 'vitest'
import type { Mock } from 'vitest'

const listeners: Record<string, Array<(...args: any[]) => void>> = {}
const emitMock = vi.fn()
const offMock = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'room-1' })
}))

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({
    socket: { id: 'socket-123' },
    isConnected: true,
    connectionError: null,
    emit: emitMock,
    on: (event: string, handler: (...args: any[]) => void) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(handler)
    },
    off: (event: string, handler?: (...args: any[]) => void) => {
      offMock(event, handler)
      if (!listeners[event]) return
      if (!handler) {
        delete listeners[event]
        return
      }
      listeners[event] = listeners[event].filter((registered) => registered !== handler)
      if (listeners[event].length === 0) {
        delete listeners[event]
      }
    }
  })
}))

const permissionsQueryMock = vi.fn()
const mediaDevicesMock = vi.fn()

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []
  static isTypeSupported = vi.fn().mockReturnValue(true)

  public ondataavailable: ((event: { data: Blob }) => void) | null = null
  public onstop: (() => void) | null = null
  public onerror: ((event: any) => void) | null = null
  public start = vi.fn()
  public stop = vi.fn(() => {
    this.onstop?.()
  })

  constructor(public stream: any, _options?: any) {
    MockMediaRecorder.instances.push(this)
  }
}

type ListenerMap = typeof listeners

const fireEvent = <TEvent extends keyof ListenerMap>(event: TEvent, payload: any) => {
  listeners[event]?.forEach((handler) => handler(payload))
}

const createMockStream = () => ({
  getTracks: () => [{ stop: vi.fn() }]
})

const roomResponse = {
  id: 'room-1',
  name: 'Weekly Sync',
  creatorId: 'creator-1',
  creator: { name: 'Alex' },
  isActive: true
}

const currentUser = { id: 'participant-1', name: 'Taylor' }

const originalFetch = global.fetch
const originalMediaDevices = navigator.mediaDevices
const originalPermissions = navigator.permissions
const originalMediaRecorder = global.MediaRecorder
const originalCreateObjectURL = URL.createObjectURL
const originalAlert = window.alert

beforeAll(() => {
  global.fetch = vi.fn() as unknown as typeof fetch
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mediaDevicesMock }
  })
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: permissionsQueryMock }
  })
  ;(global as any).MediaRecorder = MockMediaRecorder
  URL.createObjectURL = vi.fn(() => 'blob:mock') as any
  window.alert = vi.fn() as any
})

afterAll(() => {
  global.fetch = originalFetch
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices })
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: originalPermissions })
  ;(global as any).MediaRecorder = originalMediaRecorder
  URL.createObjectURL = originalCreateObjectURL
  window.alert = originalAlert
})

beforeEach(() => {
  emitMock.mockClear()
  offMock.mockClear()
  permissionsQueryMock.mockClear()
  permissionsQueryMock.mockResolvedValue({ state: 'granted' })
  mediaDevicesMock.mockClear()
  mediaDevicesMock.mockImplementation(() => Promise.resolve(createMockStream()))
  ;(URL.createObjectURL as Mock).mockClear()
  ;(window.alert as Mock).mockClear()
  MockMediaRecorder.instances = []
  MockMediaRecorder.isTypeSupported.mockClear()
  ;(global.fetch as unknown as Mock).mockImplementation(async (input: RequestInfo) => {
    if (typeof input === 'string' && input.startsWith('/api/rooms/')) {
      return {
        ok: true,
        json: async () => roomResponse
      } as Response
    }
    throw new Error(`Unexpected fetch: ${String(input)}`)
  })
  Object.keys(listeners).forEach((event) => delete listeners[event])
  localStorage.setItem('user', JSON.stringify(currentUser))
})

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe('RoomPage recording sync', () => {
  it('auto-starts and stops recording when creator toggles recording events', async () => {
    render(<RoomPage />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/rooms/room-1'))
    await waitFor(() => expect(screen.queryAllByText('Weekly Sync').length).toBeGreaterThan(0))
    await waitFor(() => expect(listeners['recording-started']).toBeDefined())

    fireEvent('recording-started', { userId: 'creator-1' })

    await waitFor(() => expect(mediaDevicesMock).toHaveBeenCalled())
    await waitFor(() => expect(MockMediaRecorder.instances.length).toBeGreaterThan(0))
    await waitFor(() => {
      expect(emitMock).toHaveBeenCalledWith('recording-started', {
        roomId: 'room-1',
        userId: currentUser.id
      })
    })

    const recorderInstance = MockMediaRecorder.instances.at(-1)
    expect(recorderInstance?.start).toHaveBeenCalled()

    fireEvent('recording-stopped', { userId: 'creator-1' })

    await waitFor(() => {
      expect(recorderInstance?.stop).toHaveBeenCalled()
      expect(emitMock).toHaveBeenCalledWith('recording-stopped', {
        roomId: 'room-1',
        userId: currentUser.id
      })
    })
  })

  it('auto-starts when joining after creator is already recording', async () => {
    render(<RoomPage />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/rooms/room-1'))
    await waitFor(() => expect(screen.queryAllByText('Weekly Sync').length).toBeGreaterThan(0))
    await waitFor(() => expect(listeners['participants-updated']).toBeDefined())

    fireEvent('participants-updated', [
      { userId: 'creator-1', userName: 'Alex', isRecording: true },
      { userId: currentUser.id, userName: currentUser.name, isRecording: false }
    ])

    await new Promise((resolve) => setTimeout(resolve, 1100))

    await waitFor(() => expect(mediaDevicesMock).toHaveBeenCalled())
    await waitFor(() => expect(MockMediaRecorder.instances.length).toBeGreaterThan(0))
    await waitFor(() => {
      expect(emitMock).toHaveBeenCalledWith('recording-started', {
        roomId: 'room-1',
        userId: currentUser.id
      })
    })
  })
})
