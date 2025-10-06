import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { db } from '@/lib/db'

const sanitizeExtension = (extension: string | null | undefined) => {
  if (!extension) return ''
  return extension.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const getExtensionFromMimeType = (mimeType: string | null | undefined) => {
  if (!mimeType) return ''
  const baseType = mimeType.split(';')[0].toLowerCase()

  switch (baseType) {
    case 'audio/webm':
      return 'webm'
    case 'audio/ogg':
      return 'ogg'
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a':
      return 'm4a'
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav'
    default:
      return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File
    const roomId = formData.get('roomId') as string
    const userId = formData.get('userId') as string
    const providedMimeType = formData.get('mimeType') as string | null
    const providedExtension = formData.get('extension') as string | null

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
    const originalName = typeof audio.name === 'string' ? audio.name : ''
    const originalExtension = sanitizeExtension(originalName.split('.').pop())
    const mimeExtension = getExtensionFromMimeType(providedMimeType || audio.type)
    const requestExtension = sanitizeExtension(providedExtension)
    const chosenExtension = requestExtension || originalExtension || mimeExtension || 'webm'
    const filename = `${roomId}_${userId}_${timestamp}.${chosenExtension}`
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
