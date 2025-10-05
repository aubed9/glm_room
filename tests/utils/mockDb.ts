import { randomUUID } from 'crypto'

type UserRecord = {
  id: string
  name: string
  email: string
  voicePrint?: string | null
  createdAt: Date
  updatedAt: Date
}

type RoomRecord = {
  id: string
  name: string
  creatorId: string
  isActive: boolean
  startedAt?: Date | null
  endedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  mergedAudio?: string | null
  recordingIds: string[]
}

type RecordingRecord = {
  id: string
  roomId: string
  userId: string
  audioPath: string
  duration?: number | null
  createdAt: Date
}

type IncludeSelector = {
  creator?: { select?: { name?: boolean } }
  recordings?: {
    include?: {
      user?: {
        select?: { name?: boolean }
      }
    }
  }
  _count?: { select?: { recordings?: boolean } }
}

type RecordingInclude = {
  user?: { select?: { name?: boolean } }
} | undefined

function buildRecording(
  recording: RecordingRecord,
  users: UserRecord[],
  include?: RecordingInclude
) {
  const base: any = { ...recording }
  if (include?.user?.select?.name) {
    const user = users.find(u => u.id === recording.userId)
    base.user = user ? { name: user.name } : null
  }
  return base
}

function buildRoom(
  room: RoomRecord,
  users: UserRecord[],
  recordings: RecordingRecord[],
  include?: IncludeSelector
) {
  const { recordingIds, ...publicRoom } = room
  const enriched: any = { ...publicRoom }

  if (include?.creator?.select?.name) {
    const creator = users.find(u => u.id === room.creatorId)
    enriched.creator = creator ? { name: creator.name } : null
  }

  if (include?._count?.select?.recordings) {
    const count = recordings.filter(rec => rec.roomId === room.id).length
    enriched._count = { recordings: count }
  }

  if (include?.recordings) {
    const matching = recordings
      .filter(rec => rec.roomId === room.id)
      .map(rec => buildRecording(rec, users, include.recordings?.include))
    enriched.recordings = matching
  }

  return enriched
}

export type MockPrismaClient = ReturnType<typeof createMockDb>

export function createMockDb() {
  const state = {
    users: [] as UserRecord[],
    rooms: [] as RoomRecord[],
    recordings: [] as RecordingRecord[]
  }

  function now() {
    return new Date()
  }

  function reset() {
    state.users.length = 0
    state.rooms.length = 0
    state.recordings.length = 0
  }

  return {
    $reset: reset,
    _state: state,
    user: {
      async findUnique({ where }: { where: { email?: string; id?: string } }) {
        if (where.email) {
          return state.users.find(user => user.email === where.email) ?? null
        }
        if (where.id) {
          return state.users.find(user => user.id === where.id) ?? null
        }
        return null
      },
      async create({ data }: { data: { name: string; email: string } }) {
        const user: UserRecord = {
          id: randomUUID(),
          name: data.name,
          email: data.email,
          voicePrint: null,
          createdAt: now(),
          updatedAt: now()
        }
        state.users.push(user)
        return { ...user }
      },
      async update({ where, data }: { where: { id: string }; data: Partial<UserRecord> }) {
        const user = state.users.find(u => u.id === where.id)
        if (!user) {
          throw new Error('User not found')
        }
        Object.assign(user, data, { updatedAt: now() })
        return { ...user }
      }
    },
    room: {
      async findMany({ include, orderBy }: { include?: IncludeSelector; orderBy?: { createdAt?: 'asc' | 'desc' } }) {
        const ordered = [...state.rooms]
        if (orderBy?.createdAt === 'desc') {
          ordered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        } else if (orderBy?.createdAt === 'asc') {
          ordered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        }
        return ordered.map(room => buildRoom(room, state.users, state.recordings, include))
      },
      async create({ data, include }: { data: { name: string; creatorId: string }; include?: IncludeSelector }) {
        const room: RoomRecord = {
          id: randomUUID(),
          name: data.name,
          creatorId: data.creatorId,
          isActive: true,
          startedAt: null,
          endedAt: null,
          createdAt: now(),
          updatedAt: now(),
          mergedAudio: null,
          recordingIds: []
        }
        state.rooms.push(room)
        return buildRoom(room, state.users, state.recordings, include)
      },
      async findUnique({ where, include }: { where: { id: string }; include?: IncludeSelector }) {
        const room = state.rooms.find(r => r.id === where.id)
        if (!room) return null
        return buildRoom(room, state.users, state.recordings, include)
      },
      async update({ where, data, include }: { where: { id: string }; data: Partial<RoomRecord>; include?: IncludeSelector }) {
        const room = state.rooms.find(r => r.id === where.id)
        if (!room) {
          throw new Error('Room not found')
        }
        Object.assign(room, data, { updatedAt: now() })
        return buildRoom(room, state.users, state.recordings, include)
      }
    },
    recording: {
      async create({ data, include }: { data: { roomId: string; userId: string; audioPath: string; duration?: number | null }; include?: RecordingInclude }) {
        const room = state.rooms.find(r => r.id === data.roomId)
        if (!room) {
          throw new Error('Room not found')
        }
        const recording: RecordingRecord = {
          id: randomUUID(),
          roomId: data.roomId,
          userId: data.userId,
          audioPath: data.audioPath,
          duration: data.duration ?? null,
          createdAt: now()
        }
        state.recordings.push(recording)
        room.recordingIds.push(recording.id)
        return buildRecording(recording, state.users, include)
      }
    }
  }
}

export const mockDb = createMockDb()

export function resetMockDb() {
  mockDb.$reset()
}

export async function seedUser(overrides: Partial<Omit<UserRecord, 'createdAt' | 'updatedAt'>> & { name?: string; email?: string } = {}) {
  const name = overrides.name ?? 'Test User'
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`
  return mockDb.user.create({ data: { name, email } })
}

export async function seedRoom(options: { creatorId: string; name?: string }) {
  const name = options.name ?? 'Test Room'
  return mockDb.room.create({ data: { name, creatorId: options.creatorId } })
}

export async function seedRecording(options: { roomId: string; userId: string; audioPath?: string; duration?: number | null }) {
  const audioPath = options.audioPath ?? `${options.roomId}_${options.userId}.wav`
  return mockDb.recording.create({
    data: {
      roomId: options.roomId,
      userId: options.userId,
      audioPath,
      duration: options.duration ?? null
    },
    include: {
      user: { select: { name: true } }
    }
  })
}
