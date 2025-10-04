import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File
    const roomId = formData.get('roomId') as string
    const userId = formData.get('userId') as string

    if (!audio || !roomId || !userId) {
      return NextResponse.json({ error: 'Audio file, room ID, and user ID are required' }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'recordings')
    try {
      await mkdir(uploadsDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Save audio file
    const timestamp = Date.now()
    const filename = `${roomId}_${userId}_${timestamp}.wav`
    const filepath = join(uploadsDir, filename)
    
    const bytes = await audio.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Save recording to database
    const recording = await db.recording.create({
      data: {
        roomId,
        userId,
        audioPath: filename,
        duration: 0 // Will be updated when processing
      },
      include: {
        user: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json(recording)
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}