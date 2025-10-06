'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PERSIAN_TEXT = "سلام، نام من است و من امروز حال خوبی دارم. این یک نمونه صدای من برای شناسایی هویت است."

export default function VoicePrintPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [hasVoicePrint, setHasVoicePrint] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [isCheckingMic, setIsCheckingMic] = useState(false)
  const [browserInfo, setBrowserInfo] = useState<string>('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      const parsedUser = JSON.parse(user)
      setCurrentUser(parsedUser)
      setHasVoicePrint(!!parsedUser.voicePrint)
    } else {
      window.location.href = '/'
    }

    // Check browser compatibility
    const checkBrowserSupport = () => {
      const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
      
      let info = `Browser: ${navigator.userAgent.split(' ')[0]} | `
      info += `Secure: ${isSecure ? '✅' : '❌'} | `
      info += `GetUserMedia: ${hasGetUserMedia ? '✅' : '❌'} | `
      info += `MediaRecorder: ${hasMediaRecorder ? '✅' : '❌'}`
      
      setBrowserInfo(info)
      
      if (!isSecure) {
        setMicError('⚠️ Microphone access requires HTTPS (except on localhost). Please use a secure connection.')
      } else if (!hasGetUserMedia) {
        setMicError('❌ Your browser does not support microphone access. Please try a modern browser like Chrome, Firefox, or Edge.')
      } else if (!hasMediaRecorder) {
        setMicError('❌ Your browser does not support MediaRecorder API. Please try a modern browser.')
      }
    }

    checkBrowserSupport()
  }, [])

  const checkMicrophonePermission = async () => {
    setIsCheckingMic(true)
    setMicError(null)
    
    try {
      // Check permission status first
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      console.log('Microphone permission status:', permissionStatus.state)
      
      if (permissionStatus.state === 'denied') {
        setMicError('❌ Microphone permission is denied. Please enable it in your browser settings.')
        setIsCheckingMic(false)
        return false
      }
      
      // Try to get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      })
      
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop())
      
      setIsCheckingMic(false)
      return true
    } catch (error: any) {
      console.error('Microphone check failed:', error)
      setIsCheckingMic(false)
      
      if (error.name === 'NotAllowedError') {
        setMicError('❌ Microphone access was denied. Please allow microphone access when prompted, or enable it in your browser settings.')
      } else if (error.name === 'NotFoundError') {
        setMicError('❌ No microphone found. Please connect a microphone and try again.')
      } else if (error.name === 'NotReadableError') {
        setMicError('❌ Microphone is already in use by another application. Please close other apps using the microphone.')
      } else if (error.name === 'NotSupportedError') {
        setMicError('❌ Microphone access is not supported in this browser or context.')
      } else {
        setMicError(`❌ Microphone error: ${error.message || 'Unknown error occurred'}`)
      }
      
      return false
    }
  }

  const startRecording = async () => {
    setMicError(null)
    
    // First check microphone permission
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
          sampleRate: 48000
        } 
      })
      
      // Check for supported MIME types
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

      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const uploadVoicePrint = async () => {
    if (!audioBlob || !currentUser) return

    setIsUploading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Audio = reader.result as string

        const response = await fetch('/api/auth/voice-print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            voicePrint: base64Audio
          })
        })

        if (response.ok) {
          const updatedUser = await response.json()
          setCurrentUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
          setHasVoicePrint(true)
          setAudioBlob(null)
          alert('Voice print saved successfully!')
        } else {
          alert('Failed to save voice print')
        }
      }
      reader.readAsDataURL(audioBlob)
    } catch (error) {
      alert('Error uploading voice print')
    } finally {
      setIsUploading(false)
    }
  }

  if (hasVoicePrint) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              Voice Print Complete
              <Badge variant="secondary">✓</Badge>
            </CardTitle>
            <CardDescription>Your voice print has been saved</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/rooms'}
            >
              Go to Rooms
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Voice Print Recording</h1>
        <p className="text-slate-600">Read the Persian text below to create your voice print</p>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Persian Text to Read</CardTitle>
          <CardDescription>Read this text clearly in your natural voice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser Compatibility Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-mono">
              {browserInfo}
            </p>
          </div>

          {/* Error Messages */}
          {micError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 whitespace-pre-line">
                {micError}
              </p>
            </div>
          )}

          <div className="p-6 bg-slate-50 rounded-lg text-center">
            <p className="text-2xl font-medium text-slate-800 leading-relaxed" dir="rtl">
              {PERSIAN_TEXT}
            </p>
            <p className="text-sm text-slate-600 mt-4">
              Pronunciation: "Salam, nam man [your-name] ast va man emruz hal-e khoobi daram. 
              In yek nemune-ye seda-ye man baraye shenakht-e hoviyat ast."
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            {audioBlob && (
              <div className="w-full">
                <audio controls className="w-full">
                  <source src={URL.createObjectURL(audioBlob)} type={audioBlob.type} />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            <div className="flex gap-4 flex-wrap justify-center">
              {!isRecording ? (
                <Button 
                  onClick={startRecording} 
                  className="bg-red-500 hover:bg-red-600"
                  disabled={isCheckingMic}
                >
                  {isCheckingMic ? '🔄 Checking...' : '🎤 Start Recording'}
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="destructive">
                  ⏹️ Stop Recording
                </Button>
              )}

              {audioBlob && (
                <Button 
                  onClick={uploadVoicePrint} 
                  disabled={isUploading}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {isUploading ? 'Saving...' : '💾 Save Voice Print'}
                </Button>
              )}
            </div>

            {isRecording && (
              <div className="flex items-center gap-2 text-red-500">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span>Recording... Speak clearly</span>
              </div>
            )}

            {/* Troubleshooting Tips */}
            <div className="w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">🔧 Troubleshooting Tips:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Use Chrome, Firefox, Edge, or Safari (latest versions)</li>
                <li>• Allow microphone access when prompted</li>
                <li>• Check browser settings if permission was denied</li>
                <li>• Ensure no other app is using the microphone</li>
                <li>• Try refreshing the page and allowing permission again</li>
                <li>• On mobile, use the browser app (not in-app browsers)</li>
              </ul>
              <div className="mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.href = '/microphone-help'}
                  className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                >
                  📖 Detailed Help Guide
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
