import { describe, it, expect } from 'vitest'
import { POST as signupPost } from '@/app/api/auth/signup/route'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as voicePrintPost } from '@/app/api/auth/voice-print/route'
import { mockDb, seedUser } from '../utils/mockDb'
import { createJsonRequest } from '../utils/request'

describe('Auth API routes', () => {
  it('rejects signup without required fields', async () => {
    const response = await signupPost(createJsonRequest({ name: 'Test' }))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toBe('Name and email are required')
  })

  it('creates a new user on signup', async () => {
    const response = await signupPost(createJsonRequest({ name: 'Casey', email: 'casey@example.com' }))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.name).toBe('Casey')
    expect(payload.email).toBe('casey@example.com')
    expect(payload.id).toBeDefined()
    expect(mockDb._state.users).toHaveLength(1)
  })

  it('returns existing user when signing up twice with same email', async () => {
    await seedUser({ name: 'Taylor', email: 'taylor@example.com' })
    const response = await signupPost(createJsonRequest({ name: 'Someone else', email: 'taylor@example.com' }))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.name).toBe('Taylor')
    expect(mockDb._state.users).toHaveLength(1)
  })

  it('rejects login without email', async () => {
    const response = await loginPost(createJsonRequest({}))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toBe('Email is required')
  })

  it('rejects login for unknown user', async () => {
    const response = await loginPost(createJsonRequest({ email: 'missing@example.com' }))
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error).toBe('User not found. Please sign up first.')
  })

  it('returns user on successful login', async () => {
    const user = await seedUser({ name: 'Avery', email: 'avery@example.com' })
    const response = await loginPost(createJsonRequest({ email: 'avery@example.com' }))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.id).toBe(user.id)
  })

  it('requires userId and voicePrint when saving voice print', async () => {
    const response = await voicePrintPost(createJsonRequest({ userId: '123' }))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toBe('User ID and voice print are required')
  })

  it('updates stored voice print for a user', async () => {
    const user = await seedUser({ name: 'Morgan', email: 'morgan@example.com' })
    const response = await voicePrintPost(createJsonRequest({ userId: user.id, voicePrint: 'base64-data' }))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.voicePrint).toBe('base64-data')
  })
})

