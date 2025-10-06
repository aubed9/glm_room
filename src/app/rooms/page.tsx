'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

interface Room {
  id: string
  name: string
  creator: { name: string }
  isActive: boolean
  createdAt: string
  startedAt?: string | null
  endedAt?: string | null
  mergedAudio?: string | null
  _count?: { recordings: number }
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomName, setRoomName] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      setCurrentUser(JSON.parse(user))
      fetchRooms()
    } else {
      window.location.href = '/'
    }
  }, [])

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms')
      if (response.ok) {
        const data = await response.json()
        setRooms(data)
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName || !currentUser) return

    setIsCreating(true)
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName,
          creatorId: currentUser.id
        })
      })

      if (response.ok) {
        const newRoom = await response.json()
        setRoomName('')
        fetchRooms()
        // Copy room link to clipboard
        const roomLink = `${window.location.origin}/room/${newRoom.id}`
        navigator.clipboard.writeText(roomLink)
        alert(`Room created! Link copied to clipboard: ${roomLink}`)
      } else {
        alert('Failed to create room')
      }
    } catch (error) {
      alert('Error creating room')
    } finally {
      setIsCreating(false)
    }
  }

  const joinRoom = (roomId: string) => {
    window.location.href = `/room/${roomId}`
  }

  const viewSession = (roomId: string) => {
    window.location.href = `/room/${roomId}/session`
  }

  const copyRoomLink = (roomId: string) => {
    const roomLink = `${window.location.origin}/room/${roomId}`
    navigator.clipboard.writeText(roomLink)
    alert('Room link copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Meeting Rooms</h1>
          <p className="text-slate-600">Create a room or join an existing one</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Room Section */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Room</CardTitle>
              <CardDescription>Start a new recording session</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createRoom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName">Room Name</Label>
                  <Input
                    id="roomName"
                    type="text"
                    placeholder="Enter room name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? 'Creating...' : '🚀 Create Room'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Rooms Section */}
          <Card>
            <CardHeader>
              <CardTitle>Rooms</CardTitle>
              <CardDescription>Join live sessions or revisit past recordings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rooms.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No rooms yet</p>
                ) : (
                  rooms.map((room) => (
                    <div key={room.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{room.name}</h3>
                        <Badge variant={room.isActive ? "default" : "secondary"}>
                          {room.isActive ? "Active" : "Ended"}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        Created by {room.creator.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(room.createdAt).toLocaleString()}
                      </p>
                      {!room.isActive && room.endedAt && (
                        <p className="text-xs text-slate-500">
                          Ended {new Date(room.endedAt).toLocaleString()}
                        </p>
                      )}
                      {room._count && (
                        <p className="text-xs text-slate-500">
                          {room._count.recordings} recordings
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => joinRoom(room.id)}
                          disabled={!room.isActive}
                        >
                          Join Room
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyRoomLink(room.id)}
                        >
                          📋 Copy Link
                        </Button>
                        {!room.isActive && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => viewSession(room.id)}
                          >
                            View Recordings
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}