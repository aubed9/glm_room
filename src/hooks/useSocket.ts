'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseSocketOptions {
  autoConnect?: boolean
}

export const useSocket = (options: UseSocketOptions = { autoConnect: true }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Determine the best Socket.IO server URL
    let socketUrl = `${window.location.protocol}//${window.location.host}`
    
    // If we're in the preview environment, we need to connect to the actual dev server
    if (window.location.hostname.includes('space.z.ai')) {
      // For preview environment, Socket.IO might not work due to network restrictions
      // Set a timeout and show a helpful message
      console.log('🔍 Preview environment detected - Socket.IO may not work due to network restrictions')
      setConnectionError('Preview environment: Real-time features may not work. Try running locally.')
      
      // Don't attempt to connect in preview environment as it will fail
      return
    }

    console.log('Connecting to Socket.IO at:', socketUrl)

    try {
      const newSocket = io(socketUrl, {
        path: '/api/socketio',
        transports: ['polling', 'websocket'],
        autoConnect: options.autoConnect,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 2,
        reconnectionDelay: 1000,
        timeout: 5000,
        withCredentials: false
      })

      socketRef.current = newSocket
      setSocket(newSocket)
      setConnectionError(null)

      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id, 'to:', socketUrl)
        setIsConnected(true)
        setConnectionError(null)
      })

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason)
        setIsConnected(false)
      })

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error to', socketUrl, ':', error.message)
        setIsConnected(false)
        setConnectionError(`Connection failed: ${error.message}`)
      })

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Socket reconnection attempt:', attemptNumber)
      })

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('✅ Socket reconnected after', attemptNumber, 'attempts')
        setIsConnected(true)
        setConnectionError(null)
      })

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect()
          socketRef.current = null
        }
      }
    } catch (error) {
      console.error('❌ Error creating socket:', error)
      setConnectionError(`Socket creation failed: ${error}`)
    }
  }, [options.autoConnect])

  const connect = () => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect()
    }
  }

  const disconnect = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect()
    }
  }

  const emit = (event: string, data: any) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data)
    } else {
      console.warn('Socket not connected, cannot emit:', event)
    }
  }

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
  }

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
  }

  return {
    socket,
    isConnected,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off
  }
}