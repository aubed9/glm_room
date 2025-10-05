import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join, extname } from 'path'

const execAsync = promisify(exec)

const sanitizeExtension = (extension: string | null | undefined) => {
  if (!extension) return ''
  return extension.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const roomId = id

    // Update room to inactive
    const room = await db.room.update({
      where: { id: roomId },
      data: {
        isActive: false,
        endedAt: new Date()
      },
      include: {
        recordings: {
          include: {
            user: {
              select: { name: true }
            }
          }
        }
      }
    })

    // Get all recordings for this room
    const recordings = room.recordings
    if (recordings.length === 0) {
      return NextResponse.json({ message: 'No recordings to process' })
    }

    // Create merged audio file using ffmpeg (if available)
    try {
      const uploadsDir = join(process.cwd(), 'uploads', 'recordings')
      const recordingFiles = recordings.map((recording) => {
        const path = join(uploadsDir, recording.audioPath)
        const extension = sanitizeExtension(extname(recording.audioPath).replace('.', ''))
        return { path, extension }
      })

      const uniqueExtensions = Array.from(new Set(recordingFiles.map(file => file.extension).filter(Boolean)))

      if (uniqueExtensions.length === 1) {
        const extension = uniqueExtensions[0]
        const mergedFilename = `${roomId}_merged.${extension}`
        const mergedPath = join(uploadsDir, mergedFilename)

        // Create a list file for ffmpeg
        const listFile = join(uploadsDir, `${roomId}_list.txt`)
        const fileListContent = recordingFiles
          .map(file => {
            const normalizedPath = file.path.replace(/\\/g, '/').replace(/"/g, '\\"')
            return `file "${normalizedPath}"`
          })
          .join('\n')

        await writeFile(listFile, fileListContent, 'utf8')

        // Use ffmpeg to merge audio files
        const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${mergedPath}"`
        await execAsync(ffmpegCommand)

        // Update room with merged audio path
        await db.room.update({
          where: { id: roomId },
          data: { mergedAudio: mergedFilename }
        })

        // Clean up list file
        await unlink(listFile)
      } else {
        console.warn('Skipping merged audio creation due to inconsistent recording formats', {
          roomId,
          extensions: uniqueExtensions
        })
      }
    } catch (ffmpegError) {
      console.error('FFmpeg error:', ffmpegError)
      // Continue without merging if ffmpeg is not available
    }

    return NextResponse.json({ 
      message: 'Session ended successfully',
      recordingsCount: recordings.length
    })
  } catch (error) {
    console.error('End session error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper functions
async function writeFile(path: string, content: string, encoding: BufferEncoding) {
  const fs = await import('fs/promises')
  return fs.writeFile(path, content, encoding)
}

async function unlink(path: string) {
  const fs = await import('fs/promises')
  return fs.unlink(path)
}
