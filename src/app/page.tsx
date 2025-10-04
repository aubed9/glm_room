'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Home() {
  const [name, setName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Check for existing user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail })
      })

      if (response.ok) {
        const user = await response.json()
        setCurrentUser(user)
        localStorage.setItem('user', JSON.stringify(user))
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Login failed')
      }
    } catch (error) {
      alert('Error during login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: signupEmail })
      })

      if (response.ok) {
        const user = await response.json()
        setCurrentUser(user)
        localStorage.setItem('user', JSON.stringify(user))
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Signup failed')
      }
    } catch (error) {
      alert('Error during signup')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('user')
    setName('')
    setLoginEmail('')
    setSignupEmail('')
  }

  if (currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome, {currentUser.name}!</CardTitle>
            <CardDescription>You're ready to create and join meeting rooms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/voice-print'}
            >
              Record Voice Print
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => window.location.href = '/rooms'}
            >
              Go to Rooms
            </Button>
            <Button 
              className="w-full" 
              variant="ghost"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Meeting Room</h1>
        <p className="text-slate-600">Create and join voice recording sessions</p>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account Access</CardTitle>
          <CardDescription>Login or create your account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="Enter your email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}