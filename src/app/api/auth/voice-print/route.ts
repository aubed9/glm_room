import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { userId, voicePrint } = await request.json()

    if (!userId || !voicePrint) {
      return NextResponse.json({ error: 'User ID and voice print are required' }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { voicePrint }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Voice print error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}