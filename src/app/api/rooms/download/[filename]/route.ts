import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

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
    const contentType = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'
    
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