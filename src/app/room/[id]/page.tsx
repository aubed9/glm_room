'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

const getExtensionFromMimeType = (mimeType: string | undefined | null) => {
  if (!mimeType) return 'webm'
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
      return 'webm'
  }
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
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [lastUploadMode, setLastUploadMode] = useState<'auto' | 'manual' | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioBlobRef = useRef<Blob | null>(null)
  const roomRef = useRef<any>(null)
  const isCreatorRef = useRef(false)
  const currentUserRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const autoStartHandlerRef = useRef<(() => Promise<void> | void) | null>(null)
  const autoStopHandlerRef = useRef<(() => void) | null>(null)
  const lastJoinedSocketIdRef = useRef<string | null>(null)
  
  const { socket, isConnected, connectionError, emit, on, off } = useSocket({ autoConnect: true })

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      setCurrentUser(JSON.parse(user))
    } else {
      window.location.href = '/'
    }
  }, [])

  const fetchRoom = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`)
      if (response.ok) {
        const roomData = await response.json()
        setRoom(roomData)
        setIsCreator(roomData.creatorId === userId)
      } else {
        alert('Room not found')
        window.location.href = '/rooms'
      }
    } catch (error) {
      console.error('Error fetching room:', error)
      window.location.href = '/rooms'
    }
  }, [roomId])

  useEffect(() => {
    if (!currentUser?.id || !roomId) return
    fetchRoom(currentUser.id)
  }, [currentUser?.id, roomId, fetchRoom])

  useEffect(() => {
    roomRef.current = room
  }, [room])

  useEffect(() => {
    isCreatorRef.current = isCreator
  }, [isCreator])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  useEffect(() => {
    audioBlobRef.current = audioBlob
  }, [audioBlob])

  useEffect(() => {
    if (!socket || !currentUser?.id) {
      return
    }

    if (!isConnected) {
      lastJoinedSocketIdRef.current = null
      return
    }

    const userId = currentUser.id
    const userName = currentUser.name
    const socketId = socket.id ?? null

    console.log('Connecting to WebSocket room:', roomId, 'for user:', userName)

    if (socketId && lastJoinedSocketIdRef.current === socketId) {
      console.log('Socket already joined room, skipping re-emit')
    } else {
      emit('join-room', {
        roomId,
        userId,
        userName
      })
      lastJoinedSocketIdRef.current = socketId
    }

    const handleParticipantsUpdated = (participantsList: any[]) => {
      console.log('Participants updated:', participantsList)
      const mappedParticipants = participantsList.map((p: any) => ({
        id: p.userId,
        userName: p.userName,
        isRecording: p.isRecording
      }))
      setParticipants(mappedParticipants)

      if (!isCreatorRef.current && roomRef.current) {
        const creator = mappedParticipants.find(p => p.id === roomRef.current?.creatorId)
        if (creator && creator.isRecording && !isRecordingRef.current) {
          console.log('Detected creator is already recording, auto-starting for new participant')
          setTimeout(() => {
            const autoStart = autoStartHandlerRef.current
            if (autoStart) {
              Promise.resolve(autoStart()).catch((error: unknown) => {
                console.error('Auto-start sync failed:', error)
              })
            }
          }, 1000)
        }
      }
    }

    const handleRecordingStarted = (data: { userId: string }) => {
      console.log('Recording started for user:', data.userId)
      setParticipants(prev => prev.map(p =>
        p.id === data.userId ? { ...p, isRecording: true } : p
      ))

      const creatorId = roomRef.current?.creatorId
      const currentId = currentUserRef.current?.id
      if (!isCreatorRef.current && data.userId !== currentId && data.userId === creatorId) {
        console.log('Room creator started recording, auto-starting for participant')
        const autoStart = autoStartHandlerRef.current
        if (autoStart) {
          Promise.resolve(autoStart()).catch((error: unknown) => {
            console.error('Auto-start sync failed:', error)
          })
        }
      }
    }

    const handleRecordingStopped = (data: { userId: string }) => {
      console.log('Recording stopped for user:', data.userId)
      setParticipants(prev => prev.map(p =>
        p.id === data.userId ? { ...p, isRecording: false } : p
      ))

      const creatorId = roomRef.current?.creatorId
      const currentId = currentUserRef.current?.id
      if (!isCreatorRef.current && data.userId !== currentId && data.userId === creatorId) {
        console.log('Room creator stopped recording, auto-stopping for participant')
        const autoStop = autoStopHandlerRef.current
        if (autoStop) {
          autoStop()
        }
      }
    }

    on('participants-updated', handleParticipantsUpdated)
    on('recording-started', handleRecordingStarted)
    on('recording-stopped', handleRecordingStopped)

    return () => {
      off('participants-updated', handleParticipantsUpdated)
      off('recording-started', handleRecordingStarted)
      off('recording-stopped', handleRecordingStopped)
    }
  }, [socket, isConnected, currentUser?.id, currentUser?.name, roomId, emit, on, off])

  const checkMicrophonePermission = async () => {
    setIsCheckingMic(true)
    setMicError(null)
    
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      
      if (permissionStatus.state === 'denied') {
        setMicError('âŒ Microphone permission is denied. Please enable it in your browser settings.')
        setIsCheckingMic(false)
        return false
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      })
      
      stream.getTracks().forEach(track => track.stop())
      
      setIsCheckingMic(false)
      return true
    } catch (error: any) {
      setIsCheckingMic(false)
      
      if (error.name === 'NotAllowedError') {
        setMicError('âŒ Microphone access was denied. Please allow microphone access when prompted.')
      } else if (error.name === 'NotFoundError') {
        setMicError('âŒ No microphone found. Please connect a microphone.')
      } else if (error.name === 'NotReadableError') {
        setMicError('âŒ Microphone is already in use by another application.')
      } else {
        setMicError(`âŒ Error: ${error.message || 'Failed to access microphone'}`)
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

    audioBlobRef.current = null
    setAudioBlob(null)
    setUploadStatus('idle')
    setUploadError(null)
    setLastUploadMode(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
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
        const completedBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioBlobRef.current = completedBlob
        setAudioBlob(completedBlob)
        uploadRecording(completedBlob, mimeType, { auto: true }).catch((error) => {
          console.error('Automatic upload failed:', error)
        })
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event)
        setMicError(`Recording error: ${event.error || 'Unknown recording error'}`)
        setIsRecording(false)
        isRecordingRef.current = false
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      isRecordingRef.current = true
      
      // Only emit if socket is connected
      if (isConnected && socket) {
        const activeUser = currentUserRef.current || currentUser
        if (activeUser?.id) {
          emit('recording-started', { roomId, userId: activeUser.id })
        }
      } else {
        console.log('Socket not connected, recording locally only')
      }
    } catch (error: any) {
      console.error('Error accessing microphone:', error)
      isRecordingRef.current = false
      
      if (error.name === 'NotAllowedError') {
        setMicError('âŒ Microphone access was denied. Please allow microphone access when prompted.')
      } else if (error.name === 'NotFoundError') {
        setMicError('âŒ No microphone found. Please connect a microphone.')
      } else if (error.name === 'NotReadableError') {
        setMicError('âŒ Microphone is already in use by another application.')
      } else {
        setMicError(`âŒ Error: ${error.message || 'Failed to access microphone'}`)
      }
    }
  }

  const handleAutoStartRecording = async () => {
    // Only proceed if not already recording and not the creator
    if (isRecordingRef.current || isCreatorRef.current) return
    
    setIsAutoRecording(true)
    setAutoRecordingMessage('ðŸŽ¤ Room creator started recording. Auto-starting your recording...')
    
    // Check microphone permission first
    const canAccess = await checkMicrophonePermission()
    if (!canAccess) {
      setAutoRecordingMessage('âŒ Cannot start recording: Microphone access denied')
      setTimeout(() => setAutoRecordingMessage(null), 3000)
      setIsAutoRecording(false)
      return
    }


    audioBlobRef.current = null
    setAudioBlob(null)
    setUploadStatus('idle')
    setUploadError(null)
    setLastUploadMode(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
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
        const completedBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioBlobRef.current = completedBlob
        setAudioBlob(completedBlob)
        uploadRecording(completedBlob, mimeType, { auto: true }).catch((error) => {
          console.error('Automatic upload failed:', error)
        })
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event)
        setMicError(`Auto-recording error: ${event.error || 'Unknown recording error'}`)
        setIsRecording(false)
        isRecordingRef.current = false
        setIsAutoRecording(false)
        setAutoRecordingMessage('âŒ Auto-recording failed')
        setTimeout(() => setAutoRecordingMessage(null), 3000)
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      isRecordingRef.current = true
      setAutoRecordingMessage('âœ… Recording automatically started')
      setTimeout(() => setAutoRecordingMessage(null), 3000)
      
      // Emit recording started event
      if (isConnected && socket) {
        const activeUser = currentUserRef.current || currentUser
        if (activeUser?.id) {
          emit('recording-started', { roomId, userId: activeUser.id })
        }
      }
    } catch (error: any) {
      console.error('Error in auto-starting recording:', error)
      isRecordingRef.current = false
      setIsAutoRecording(false)
      
      if (error.name === 'NotAllowedError') {
        setAutoRecordingMessage('âŒ Microphone access was denied for auto-recording')
      } else if (error.name === 'NotFoundError') {
        setAutoRecordingMessage('âŒ No microphone found for auto-recording')
      } else if (error.name === 'NotReadableError') {
        setAutoRecordingMessage('âŒ Microphone is already in use by another application')
      } else {
        setAutoRecordingMessage(`âŒ Auto-recording error: ${error.message || 'Failed to start recording'}`)
      }
      setTimeout(() => setAutoRecordingMessage(null), 3000)
    }
  }

  const handleAutoStopRecording = () => {
    // Only proceed if currently recording and not the creator
    if (!isRecordingRef.current || isCreatorRef.current) return
    
    setAutoRecordingMessage('â¹ï¸ Room creator stopped recording. Auto-stopping your recording...')
    
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      isRecordingRef.current = false
      setIsAutoRecording(false)
      setAutoRecordingMessage('âœ… Recording automatically stopped')
      setTimeout(() => setAutoRecordingMessage(null), 3000)
      
      // Emit recording stopped event
      if (isConnected && socket) {
        const activeUser = currentUserRef.current || currentUser
        if (activeUser?.id) {
          emit('recording-stopped', { roomId, userId: activeUser.id })
        }
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      isRecordingRef.current = false
      
      // Only emit if socket is connected
      if (isConnected && socket) {
        const activeUser = currentUserRef.current || currentUser
        if (activeUser?.id) {
          emit('recording-stopped', { roomId, userId: activeUser.id })
        }
      } else {
        console.log('Socket not connected, stopped recording locally only')
      }
    }
  }

  useEffect(() => {
    autoStartHandlerRef.current = handleAutoStartRecording
  }, [handleAutoStartRecording])

  useEffect(() => {
    autoStopHandlerRef.current = handleAutoStopRecording
  }, [handleAutoStopRecording])

  useEffect(() => {
    const creatorId = room?.creatorId
    if (!creatorId) {
      return
    }

    if (isCreatorRef.current) {
      return
    }

    const creatorParticipant = participants.find((participant) => participant.id === creatorId)
    if (!creatorParticipant) {
      return
    }

    if (creatorParticipant.isRecording && !isRecordingRef.current) {
      const autoStart = autoStartHandlerRef.current
      if (autoStart) {
        Promise.resolve(autoStart()).catch((error: unknown) => {
          console.error('Auto-start sync failed:', error)
        })
      }
    } else if (!creatorParticipant.isRecording && isRecordingRef.current) {
      const autoStop = autoStopHandlerRef.current
      if (autoStop) {
        autoStop()
      }
    }
  }, [participants, room?.creatorId])

  const uploadRecording = useCallback(async (
    blobOverride?: Blob | null,
    mimeTypeOverride?: string | null,
    options?: { auto?: boolean }
  ) => {
    const blobToUpload = blobOverride ?? audioBlobRef.current
    const activeUser = currentUserRef.current

    if (!blobToUpload || !activeUser?.id) {
      console.warn('No recording or user available for upload')
      return false
    }

    const mimeType = mimeTypeOverride || blobToUpload.type || 'audio/webm'
    const extension = getExtensionFromMimeType(mimeType)
    const fileName = `recording.${extension}`
    const formData = new FormData()

    if (typeof File !== 'undefined') {
      const audioFile = new File([blobToUpload], fileName, { type: mimeType })
      formData.append('audio', audioFile)
    } else {
      formData.append('audio', blobToUpload, fileName)
    }

    formData.append('roomId', roomId)
    formData.append('userId', activeUser.id)
    formData.append('mimeType', mimeType)
    formData.append('extension', extension)

    setIsUploading(true)
    setUploadStatus('uploading')
    setUploadError(null)
    setLastUploadMode(options?.auto ? 'auto' : 'manual')

    try {
      const response = await fetch('/api/rooms/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`)
      }

      setUploadStatus('success')

      if (options?.auto && !isCreatorRef.current) {
        setAutoRecordingMessage('Recording uploaded automatically.')
        setTimeout(() => setAutoRecordingMessage(null), 3000)
      }

      return true
    } catch (error: unknown) {
      console.error('Error uploading recording:', error)
      setUploadStatus('error')
      const message = error instanceof Error ? error.message : 'Upload failed. Please try again.'
      setUploadError(message)

      if (options?.auto && !isCreatorRef.current) {
        setAutoRecordingMessage('Upload failed. Please upload your recording manually.')
        setTimeout(() => setAutoRecordingMessage(null), 4000)
      }

      return false
    } finally {
      setIsUploading(false)
    }
  }, [roomId])

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
            Created by {room.creator?.name || 'Unknown'} â€¢ 
            {room.isActive ? (
              <Badge variant="default" className="ml-2">Active</Badge>
            ) : (
              <Badge variant="secondary" className="ml-2">Ended</Badge>
            )}
          </p>
          <div className="mt-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "ðŸŸ¢ Connected" : "ðŸ”´ Disconnected"}
            </Badge>
            {socket && (
              <Badge variant="outline" className="ml-2">
                Socket ID: {socket.id?.substring(0, 8)}...
              </Badge>
            )}
            {connectionError && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                âš ï¸ {connectionError}
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
                            âš ï¸ {connectionError}
                            <br />
                            <span className="text-xs">Recording will work locally, but real-time sync is disabled.</span>
                          </>
                        ) : (
                          'âš ï¸ Connecting to room... Please wait.'
                        )}
                      </p>
                    </div>
                  )}
                  
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-full ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                    disabled={!room.isActive || isCheckingMic}
                  >
                    {isCheckingMic ? 'ðŸ”„ Checking...' : isRecording ? 'â¹ï¸ Stop Recording' : 'ðŸŽ¤ Start Recording'}
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
                    disabled={isRecording || isUploading}
                  >
                    ðŸ›‘ End Session
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
                      autoRecordingMessage.includes('âŒ')
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : autoRecordingMessage.includes('âœ…')
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
                    {uploadStatus === 'uploading' && (
                      <p className="text-sm text-slate-600">Uploading recording...</p>
                    )}
                    {uploadStatus === 'success' && (
                      <p className="text-sm text-green-600">
                        {lastUploadMode === 'auto'
                          ? 'Recording uploaded automatically.'
                          : 'Recording uploaded successfully.'}
                      </p>
                    )}
                    {uploadStatus === 'error' && (
                      <p className="text-sm text-red-600">
                        {uploadError ? `Upload failed: ${uploadError}` : 'Upload failed. Please try again.'}
                      </p>
                    )}
                    <Button
                      onClick={() => uploadRecording(undefined, undefined, { auto: false })}
                      className="w-full"
                      disabled={isUploading}
                    >
                      {isUploading
                        ? 'Uploading...'
                        : lastUploadMode === 'auto' && uploadStatus === 'success'
                        ? 'Re-upload Recording'
                        : 'Upload Recording'}
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
            â† Back to Rooms
          </Button>
        </div>
      </div>
    </div>
  )
}

