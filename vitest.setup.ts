import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import { mockDb, resetMockDb } from './tests/utils/mockDb'

process.env.NODE_ENV = 'test'

vi.mock('child_process', () => ({
  exec: (_command: string, callback: (...args: any[]) => void) => {
    callback(null, { stdout: '', stderr: '' })
  }
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

beforeEach(() => {
  resetMockDb()
})
