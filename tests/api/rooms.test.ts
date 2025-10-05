import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { mkdir, rm, access, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { GET as listRooms, POST as createRoom } from '@/app/api/rooms/route'
import { GET as fetchRoom } from '@/app/api/rooms/[id]/route'
import { POST as endRoom } from '@/app/api/rooms/[id]/end/route'
import { POST as uploadRecording } from '@/app/api/rooms/upload/route'
import { GET as downloadRecording } from '@/app/api/rooms/download/[filename]/route'
import { seedUser, seedRoom, seedRecording, mockDb } from '../utils/mockDb'
import { createJsonRequest, createFormDataRequest } from '../utils/request'

const tmpRoot = join(tmpdir(), 'glm-room-tests')
const uploadsRoot = join(tmpRoot, 'uploads')
const recordingsDir = join(uploadsRoot, 'recordings')
let cwdSpy: ReturnType<typeof vi.spyOn>

describe('Room API routes', () => {
  beforeAll(async () => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot)
    await rm(tmpRoot, { recursive: true, force: true })
  })

  afterAll(async () => {
    cwdSpy.mockRestore()
    await rm(tmpRoot, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
    await mkdir(recordingsDir, { recursive: true })
  })

  it('returns an empty list of rooms initially', async () => {
    const response = await listRooms()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual([])
  })

  it('validates required fields when creating a room', async () => {
    const response = await createRoom(createJsonRequest({ name: 'Room' }))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toBe('Room name and creator ID are required')
  })

  it('creates a room and returns creator details', async () => {
    const user = await seedUser({ name: 'Sam' })
    const response = await createRoom(createJsonRequest({ name: 'Standup', creatorId: user.id }))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.name).toBe('Standup')
    expect(payload.creator).toEqual({ name: 'Sam' })
  })

  it('lists rooms with recording counts', async () => {
    const user = await seedUser({ name: 'Dana' })
    const room = await seedRoom({ creatorId: user.id, name: 'Retro' })
    await seedRecording({ roomId: room.id, userId: user.id })

    const response = await listRooms()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload[0]._count.recordings).toBe(1)
  })

  it('returns 404 for unknown room id', async () => {
    const response = await fetchRoom({} as any, { params: Promise.resolve({ id: 'missing' }) })
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error).toBe('Room not found')
  })

  it('fetches room details with recordings', async () => {
    const user = await seedUser({ name: 'Robin' })
    const room = await seedRoom({ creatorId: user.id, name: 'Weekly' })
    await seedRecording({ roomId: room.id, userId: user.id })

    const response = await fetchRoom({} as any, { params: Promise.resolve({ id: room.id }) })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.id).toBe(room.id)
    expect(payload.recordings).toHaveLength(1)
    expect(payload.recordings[0].user).toEqual({ name: 'Robin' })
  })

  it('returns message when ending a room without recordings', async () => {
    const user = await seedUser()
    const room = await seedRoom({ creatorId: user.id })

    const response = await endRoom({} as any, { params: Promise.resolve({ id: room.id }) })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ message: 'No recordings to process' })
    expect(mockDb._state.rooms[0].isActive).toBe(false)
  })

  it('merges recordings when ending a room with audio', async () => {
    const user = await seedUser()
    const room = await seedRoom({ creatorId: user.id })
    await seedRecording({ roomId: room.id, userId: user.id, audioPath: `${room.id}_${user.id}.wav` })

    const response = await endRoom({} as any, { params: Promise.resolve({ id: room.id }) })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.recordingsCount).toBe(1)
    const storedRoom = mockDb._state.rooms[0]
    expect(storedRoom.isActive).toBe(false)
    expect(storedRoom.mergedAudio).toBe(`${room.id}_merged.wav`)
  })

  it('rejects upload without full payload', async () => {
    const response = await uploadRecording(createFormDataRequest(new FormData()))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toBe('Audio file, room ID, and user ID are required')
  })

  it('stores uploaded audio on disk and in datastore', async () => {
    const user = await seedUser()
    const room = await seedRoom({ creatorId: user.id })
    const formData = new FormData()
    const audioBlob = new Uint8Array([1, 2, 3])
    formData.set('audio', new File([audioBlob], 'clip.wav', { type: 'audio/wav' }))
    formData.set('roomId', room.id)
    formData.set('userId', user.id)

    const response = await uploadRecording(createFormDataRequest(formData))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.audioPath).toMatch(`${room.id}_${user.id}`)

    await access(join(recordingsDir, payload.audioPath))
    expect(mockDb._state.recordings).toHaveLength(1)
  })

  it('runs a full recording lifecycle via API routes', async () => {
    const user = await seedUser({ name: 'Jordan' })
    const createResponse = await createRoom(createJsonRequest({ name: 'Daily Sync', creatorId: user.id }))
    expect(createResponse.status).toBe(200)
    const createdRoom = await createResponse.json()
    expect(createdRoom.id).toBeDefined()
    expect(createdRoom.creator).toEqual({ name: 'Jordan' })

    const formData = new FormData()
    const audioBuffer = new Uint8Array([9, 8, 7, 6])
    formData.set('audio', new File([audioBuffer], 'segment.wav', { type: 'audio/wav' }))
    formData.set('roomId', createdRoom.id)
    formData.set('userId', user.id)

    const uploadResponse = await uploadRecording(createFormDataRequest(formData))
    expect(uploadResponse.status).toBe(200)
    const uploadedRecording = await uploadResponse.json()
    expect(uploadedRecording.roomId).toBe(createdRoom.id)
    expect(uploadedRecording.user).toEqual({ name: 'Jordan' })

    await access(join(recordingsDir, uploadedRecording.audioPath))

    const endResponse = await endRoom({} as any, { params: Promise.resolve({ id: createdRoom.id }) })
    expect(endResponse.status).toBe(200)
    const endedPayload = await endResponse.json()
    expect(endedPayload.recordingsCount).toBe(1)

    const storedRoom = mockDb._state.rooms.find(room => room.id === createdRoom.id)
    expect(storedRoom?.isActive).toBe(false)
    expect(storedRoom?.mergedAudio).toBe(`${createdRoom.id}_merged.wav`)
  })

  it('downloads an existing recording file', async () => {
    const filename = 'sample.wav'
    await writeFile(join(recordingsDir, filename), Buffer.from([0, 1, 2]))

    const response = await downloadRecording({} as any, { params: Promise.resolve({ filename }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/wav')
    expect(response.headers.get('Content-Disposition')).toContain(filename)
    const buffer = Buffer.from(await response.arrayBuffer())
    expect(buffer.length).toBe(3)
  })

  it('returns 404 when downloading a missing file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await downloadRecording({} as any, { params: Promise.resolve({ filename: 'missing.wav' }) })
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error).toBe('File not found')
    errorSpy.mockRestore()
  })
})
