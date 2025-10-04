'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useSocket } from '@/hooks/useSocket'

interface Participant {
  id: string
  userName: string
  isRecording: boolean
}

export default function RoomPage() {
  const params = useParams()
  const roomId = params.id as string
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [room, setRoom] = useState<any>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [isCheckingMic, setIsCheckingMic] = useState(false)
  const [autoRecordingMessage, setAutoRecordingMessage] = useState<string | null>(null)
  const [isAutoRecording, setIsAutoRecording] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  const { socket, isConnected, connectionError, emit, on, off } = useSocket({ autoConnect: true })

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      setCurrentUser(JSON.parse(user))
    } else {
      window.location.href = '/'
    }
  }, [])

  useEffect(() => {
    if (currentUser && roomId && socket && isConnected) {
      fetchRoom()
      connectWebSocket()
    }
  }, [currentUser, roomId, socket, isConnected])

  useEffect(() => {
    return () => {
      // Cleanup will be handled by the useSocket hook
    }
  }, [])

  const fetchRoom = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`)
      if (response.ok) {
        const roomData = await response.json()
        setRoom(roomData)
        setIsCreator(roomData.creatorId === currentUser.id)
      } else {
        alert('Room not found')
        window.location.href = '/rooms'
      }
    } catch (error) {
      console.error('Error fetching room:', error)
      window.location.href = '/rooms'
    }
  }

  const connectWebSocket = () => {
    if (!socket || !isConnected) {
      console.log('Cannot connect WebSocket: socket or isConnected is false', { socket: !!socket, isConnected })
      return
    }

    console.log('Connecting to WebSocket room:', roomId, 'for user:', currentUser.name)

    // Join room
    emit('join-room', {
      roomId,
      userId: currentUser.id,
      userName: currentUser.name
    })

    // Listen for participant updates
    on('participants-updated', (participants: any[]) => {
      console.log('Participants updated:', participants)
      // Map socket data structure to our Participant interface
      const mappedParticipants = participants.map((p: any) => ({
        id: p.userId,
        userName: p.userName,
        isRecording: p.isRecording
      }))
      setParticipants(mappedParticipants)
      
      // Handle edge case: participant joins after recording has already started
      if (!isCreator && room) {
        const creator = mappedParticipants.find(p => p.id === room.creatorId)
        if (creator && creator.isRecording && !isRecording) {
          console.log('Detected creator is already recording, auto-starting for new participant')
          setTimeout(() => handleAutoStartRecording(), 1000) // Small delay to ensure everything is loaded
        }
      }
    })

    // Listen for recording events
    on('recording-started', (data: { userId: string }) => {
      console.log('Recording started for user:', data.userId)
      setParticipants(prev => prev.map(p =>
        p.id === data.userId ? { ...p, isRecording: true } : p
      ))
      
      // Handle automatic recording for non-creator participants
      if (!isCreator && data.userId !== currentUser.id) {
        // Check if the event is from the room creator
        if (data.userId === room?.creatorId) {
          console.log('Room creator started recording, auto-starting for participant')
          handleAutoStartRecording()
        }
      }
    })

    on('recording-stopped', (data: { userId: string }) => {
      console.log('Recording stopped for user:', data.userId)
      setParticipants(prev => prev.map(p =>
        p.id === data.userId ? { ...p, isRecording: false } : p
      ))
      
      // Handle automatic recording stop for non-creator participants
      if (!isCreator && data.userId !== currentUser.id) {
        // Check if the event is from the room creator
        if (data.userId === room?.creatorId) {
          console.log('Room creator stopped recording, auto-stopping for participant')
          handleAutoStopRecording()
        }
      }
    })
  }

  const checkMicrophonePermission = async () => {
    setIsCheckingMic(true)
    setMicError(null)
    
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      
      if (permissionStatus.state === 'denied') {
        setMicError('❌ Microphone permission is denied. Please enable it in your browser settings.')
        setIsCheckingMic(false)
        return false
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      })
      
      stream.getTracks().forEach(track => track.stop())
      
      setIsCheckingMic(false)
      return true
    } catch (error: any) {
      setIsCheckingMic(false)
      
      if (error.name === 'NotAllowedError') {
        setMicError('❌ Microphone access was denied. Please allow microphone access when prompted.')
      } else if (error.name === 'NotFoundError') {
        setMicError('❌ No microphone found. Please connect a microphone.')
      } else if (error.name === 'NotReadableError') {
        setMicError('❌ Microphone is already in use by another application.')
      } else {
        setMicError(`❌ Error: ${error.message || 'Failed to access microphone'}`)
      }
      
      return false
    }
  }

  const startRecording = async () => {
    setMicError(null)
    
    const canAccess = await checkMicrophonePermission()
    if (!canAccess) {
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      })
      
      let mimeType = 'audio/webm'
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/wav',
        'audio/mp4'
      ]
      
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event)
        setMicError(`Recording error: ${event.error || 'Unknown recording error'}`)
        setIsRecording(false)
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      
      // Only emit if socket is connected
      if (isConnected && socket) {
        emit('recording-started', { roomId, userId: currentUser.id })
      } else {
        console.log('Socket not connected, recording locally only')
      }
    } catch (error: any) {
      console.error('Error accessing microphone:', error)
      
      if (error.name === 'NotAllowedError') {
        setMicError('❌ Microphone access was denied. Please allow microphone access when prompted.')
      } else if (error.name === 'NotFoundError') {
        setMicError('❌ No microphone found. Please connect a microphone.')
      } else if (error.name === 'NotReadableError') {
        setMicError('❌ Microphone is already in use by another application.')
      } else {
        setMicError(`❌ Error: ${error.message || 'Failed to access microphone'}`)
      }
    }
  }

  const handleAutoStartRecording = async () => {
    // Only proceed if not already recording and not the creator
    if (isRecording || isCreator) return
    
    setIsAutoRecording(true)
    setAutoRecordingMessage('🎤 Room creator started recording. Auto-starting your recording...')
    
    // Check microphone permission first
    const canAccess = await checkMicrophonePermission()
    if (!canAccess) {
      setAutoRecordingMessage('❌ Cannot start recording: Microphone access denied')
      setTimeout(() => setAutoRecordingMessage(null), 3000)
      setIsAutoRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })
      
      let mimeType = 'audio/webm'
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/wav',
        'audio/mp4'
      ]
      
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event)
        setMicError(`Auto-recording error: ${event.error || 'Unknown recording error'}`)
        setIsRecording(false)
        setIsAutoRecording(false)
        setAutoRecordingMessage('❌ Auto-recording failed')
        setTimeout(() => setAutoRecordingMessage(null), 3000)
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      setAutoRecordingMessage('✅ Recording automatically started')
      setTimeout(() => setAutoRecordingMessage(null), 3000)
      
      // Emit recording started event
      if (isConnected && socket) {
        emit('recording-started', { roomId, userId: currentUser.id })
      }
    } catch (error: any) {
      console.error('Error in auto-starting recording:', error)
      setIsAutoRecording(false)
      
      if (error.name === 'NotAllowedError') {
        setAutoRecordingMessage('❌ Microphone access was denied for auto-recording')
      } else if (error.name === 'NotFoundError') {
        setAutoRecordingMessage('❌ No microphone found for auto-recording')
      } else if (error.name === 'NotReadableError') {
        setAutoRecordingMessage('❌ Microphone is already in use by another application')
      } else {
        setAutoRecordingMessage(`❌ Auto-recording error: ${error.message || 'Failed to start recording'}`)
      }
      setTimeout(() => setAutoRecordingMessage(null), 3000)
    }
  }

  const handleAutoStopRecording = () => {
    // Only proceed if currently recording and not the creator
    if (!isRecording || isCreator) return
    
    setAutoRecordingMessage('⏹️ Room creator stopped recording. Auto-stopping your recording...')
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsAutoRecording(false)
      setAutoRecordingMessage('✅ Recording automatically stopped')
      setTimeout(() => setAutoRecordingMessage(null), 3000)
      
      // Emit recording stopped event
      if (isConnected && socket) {
        emit('recording-stopped', { roomId, userId: currentUser.id })
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // Only emit if socket is connected
      if (isConnected && socket) {
        emit('recording-stopped', { roomId, userId: currentUser.id })
      } else {
        console.log('Socket not connected, stopped recording locally only')
      }
    }
  }

  const uploadRecording = async () => {
    if (!audioBlob || !currentUser) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')
      formData.append('roomId', roomId)
      formData.append('userId', currentUser.id)

      const response = await fetch('/api/rooms/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setAudioBlob(null)
        alert('Recording uploaded successfully!')
      } else {
        alert('Failed to upload recording')
      }
    } catch (error) {
      alert('Error uploading recording')
    } finally {
      setIsUploading(false)
    }
  }

  const endSession = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/end`, {
        method: 'POST'
      })

      if (response.ok) {
        alert('Session ended! Processing recordings...')
        window.location.href = `/room/${roomId}/session`
      } else {
        alert('Failed to end session')
      }
    } catch (error) {
      alert('Error ending session')
    }
  }

  if (!currentUser || !room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading room...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">{room.name}</h1>
          <p className="text-slate-600">
            Created by {room.creator?.name || 'Unknown'} • 
            {room.isActive ? (
              <Badge variant="default" className="ml-2">Active</Badge>
            ) : (
              <Badge variant="secondary" className="ml-2">Ended</Badge>
            )}
          </p>
          <div className="mt-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
            </Badge>
            {socket && (
              <Badge variant="outline" className="ml-2">
                Socket ID: {socket.id?.substring(0, 8)}...
              </Badge>
            )}
            {connectionError && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                ⚠️ {connectionError}
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recording Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Recording Controls</CardTitle>
              <CardDescription>
                {isCreator ? "Start the session recording" : "Wait for creator to start"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!room.isActive ? (
                <p className="text-center text-slate-500 py-4">This session has ended</p>
              ) : isCreator ? (
                <div className="space-y-4">
                  {!isConnected && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        {connectionError ? (
                          <>
                            ⚠️ {connectionError}
                            <br />
                            <span className="text-xs">Recording will work locally, but real-time sync is disabled.</span>
                          </>
                        ) : (
                          '⚠️ Connecting to room... Please wait.'
                        )}
                      </p>
                    </div>
                  )}
                  
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-full ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                    disabled={!room.isActive || isCheckingMic}
                  >
                    {isCheckingMic ? '🔄 Checking...' : isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
                  </Button>
                  
                  {isRecording && (
                    <div className="flex items-center gap-2 text-red-500">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span>Recording in progress...</span>
                    </div>
                  )}

                  {/* Error Messages */}
                  {micError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800 whitespace-pre-line">
                        {micError}
                      </p>
                    </div>
                  )}

                  <Separator />

                  <Button
                    onClick={endSession}
                    variant="destructive"
                    className="w-full"
                    disabled={isRecording}
                  >
                    🛑 End Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-slate-600">
                    Waiting for room creator to start recording...
                  </p>
                  
                  {isAutoRecording ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Auto-recording synchronized with room creator</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-500">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span>Stand by</span>
                    </div>
                  )}
                  
                  {/* Auto-recording message */}
                  {autoRecordingMessage && (
                    <div className={`p-3 rounded-lg text-sm ${
                      autoRecordingMessage.includes('❌')
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : autoRecordingMessage.includes('✅')
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-blue-50 border border-blue-200 text-blue-800'
                    }`}>
                      {autoRecordingMessage}
                    </div>
                  )}
                </div>
              )}

              {audioBlob && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your Recording:</p>
                    <audio controls className="w-full">
                      <source src={URL.createObjectURL(audioBlob)} type={audioBlob.type} />
                    </audio>
                    <Button
                      onClick={uploadRecording}
                      className="w-full"
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : '📤 Upload Recording'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>Users in this room</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {participants.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No participants yet</p>
                ) : (
                  participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                          {participant.userName ? participant.userName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className="font-medium">{participant.userName || 'Unknown User'}</span>
                        {participant.id === currentUser.id && (
                          <Badge variant="outline">You</Badge>
                        )}
                      </div>
                      <Badge variant={
                        participant.isRecording
                          ? (participant.id === currentUser.id && isAutoRecording ? "default" : "destructive")
                          : "secondary"
                      }>
                        {participant.isRecording
                          ? (participant.id === currentUser.id && isAutoRecording ? "Auto-Recording" : "Recording")
                          : "Idle"
                        }
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => window.location.href = '/rooms'}>
            ← Back to Rooms
          </Button>
        </div>
      </div>
    </div>
  )
}