'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function MicrophoneHelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Microphone Access Help</h1>
          <p className="text-slate-600">Follow these steps to enable microphone access</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>🔐 HTTPS Requirement</CardTitle>
              <CardDescription>Modern browsers require secure connections for microphone access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 font-medium">For Development:</p>
                <p className="text-blue-700">Use the HTTPS server: <code>npm run dev:https</code></p>
                <p className="text-blue-700">Then visit: <code>https://localhost:3443</code></p>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-medium">Browser Security Warning:</p>
                <p className="text-yellow-700">You'll see a security warning for self-signed certificates. Click "Advanced" → "Proceed to localhost (unsafe)"</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🌐 Browser Instructions</CardTitle>
              <CardDescription>How to enable microphone access in different browsers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-800">Chrome/Edge:</h4>
                  <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                    <li>Click the lock icon 📍 in the address bar</li>
                    <li>Find "Microphone" in the permissions list</li>
                    <li>Change setting to "Allow"</li>
                    <li>Refresh the page</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-800">Firefox:</h4>
                  <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                    <li>Click the lock icon 📍 in the address bar</li>
                    <li>Find "Use the Microphone" in permissions</li>
                    <li>Change setting to "Allow"</li>
                    <li>Refresh the page</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-medium text-slate-800">Safari:</h4>
                  <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                    <li>Go to Safari → Settings → Websites</li>
                    <li>Select "Microphone" from the left panel</li>
                    <li>Find localhost in the list and set to "Allow"</li>
                    <li>Refresh the page</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔧 Troubleshooting</CardTitle>
              <CardDescription>Common issues and solutions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-red-800">Permission Denied:</p>
                  <p className="text-sm text-red-700">Check browser settings or try incognito mode</p>
                </div>
                
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-red-800">No Microphone Found:</p>
                  <p className="text-sm text-red-700">Connect a microphone and check system settings</p>
                </div>
                
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-red-800">Microphone in Use:</p>
                  <p className="text-sm text-red-700">Close other apps using the microphone</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📱 Mobile Devices</CardTitle>
              <CardDescription>Additional steps for mobile users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-slate-800">iOS Safari:</h4>
                  <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                    <li>Go to Settings → Safari & Privacy</li>
                    <li>Ensure "Microphone" permission is enabled</li>
                    <li>Use the native Safari app (not in-app browsers)</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-800">Android Chrome:</h4>
                  <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                    <li>Go to Settings → Apps → Chrome → Permissions</li>
                    <li>Enable "Microphone" permission</li>
                    <li>Use the native Chrome app</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button onClick={() => window.history.back()}>
            ← Back to App
          </Button>
        </div>
      </div>
    </div>
  )
}