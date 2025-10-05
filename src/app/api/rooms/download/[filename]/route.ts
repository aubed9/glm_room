import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'

const getContentTypeFromFilename = (filename: string) => {
  const extension = extname(filename).toLowerCase()

  switch (extension) {
    case '.wav':
    case '.wave':
      return 'audio/wav'
    case '.webm':
      return 'audio/webm'
    case '.ogg':
      return 'audio/ogg'
    case '.mp3':
      return 'audio/mpeg'
    case '.m4a':
    case '.mp4':
      return 'audio/mp4'
    default:
      return 'application/octet-stream'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const filePath = join(process.cwd(), 'uploads', 'recordings', filename)
    
    // Read the file
    const fileBuffer = await readFile(filePath)
    
    // Determine content type
    const contentType = getContentTypeFromFilename(filename)
    
    // Return the file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
