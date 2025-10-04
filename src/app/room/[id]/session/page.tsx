'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface Recording {
  id: string
  audioPath: string
  duration: number
  createdAt: string
  user: {
    name: string
  }
}

interface Room {
  id: string
  name: string
  creator: {
    name: string
  }
  isActive: boolean
  startedAt: string
  endedAt: string
  mergedAudio: string | null
  recordings: Recording[]
}

export default function SessionPage() {
  const params = useParams()
  const roomId = params.id as string
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      setCurrentUser(JSON.parse(user))
      fetchSession()
    } else {
      window.location.href = '/'
    }
  }, [])

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`)
      if (response.ok) {
        const roomData = await response.json()
        setRoom(roomData)
      } else {
        alert('Session not found')
        window.location.href = '/rooms'
      }
    } catch (error) {
      console.error('Error fetching session:', error)
      window.location.href = '/rooms'
    } finally {
      setIsLoading(false)
    }
  }

  const downloadAudio = (filename: string, displayName: string) => {
    const link = document.createElement('a')
    link.href = `/api/rooms/download/${filename}`
    link.download = displayName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading session...</div>
      </div>
    )
  }

  if (!room || room.isActive) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Session Not Available</h2>
          <p className="text-slate-600 mb-4">This session has not ended yet or does not exist.</p>
          <Button onClick={() => window.location.href = '/rooms'}>
            Back to Rooms
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">{room.name}</h1>
          <p className="text-slate-600">
            Session completed • Created by {room.creator.name}
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge variant="secondary">
              Started: {formatDate(room.startedAt)}
            </Badge>
            <Badge variant="secondary">
              Ended: {formatDate(room.endedAt)}
            </Badge>
            <Badge variant="outline">
              {room.recordings.length} recordings
            </Badge>
          </div>
        </div>

        {/* Merged Audio Section */}
        {room.mergedAudio && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎵 Complete Session Audio
                <Badge variant="default">Merged</Badge>
              </CardTitle>
              <CardDescription>
                All recordings combined into a single audio file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <audio controls className="w-full">
                <source src={`/api/rooms/download/${room.mergedAudio}`} type="audio/wav" />
                Your browser does not support the audio element.
              </audio>
              <Button
                onClick={() => downloadAudio(room.mergedAudio!, `${room.name}_complete.wav`)}
                className="w-full"
              >
                📥 Download Complete Audio
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Individual Recordings */}
        <Card>
          <CardHeader>
            <CardTitle>Individual Recordings</CardTitle>
            <CardDescription>
              Download separate audio files from each participant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {room.recordings.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No recordings found</p>
            ) : (
              <div className="space-y-4">
                {room.recordings.map((recording) => (
                  <div key={recording.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                          {recording.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-medium">{recording.user.name}</h3>
                          <p className="text-sm text-slate-600">
                            {formatDate(recording.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">
                          {formatDuration(recording.duration)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <audio controls className="w-full">
                        <source src={`/api/rooms/download/${recording.audioPath}`} type="audio/wav" />
                        Your browser does not support the audio element.
                      </audio>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadAudio(
                          recording.audioPath,
                          `${recording.user.name.replace(/\s+/g, '_')}_recording.wav`
                        )}
                      >
                        📥 Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex gap-4 justify-center">
          <Button variant="outline" onClick={() => window.location.href = '/rooms'}>
            ← Back to Rooms
          </Button>
          <Button onClick={() => window.location.href = `/room/${roomId}`}>
            Back to Room
          </Button>
        </div>
      </div>
    </div>
  )
}