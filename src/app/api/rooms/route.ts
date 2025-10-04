import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const rooms = await db.room.findMany({
      include: {
        creator: {
          select: { name: true }
        },
        _count: {
          select: { recordings: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(rooms)
  } catch (error) {
    console.error('Error fetching rooms:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, creatorId } = await request.json()

    if (!name || !creatorId) {
      return NextResponse.json({ error: 'Room name and creator ID are required' }, { status: 400 })
    }

    const room = await db.room.create({
      data: {
        name,
        creatorId
      },
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json(room)
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}