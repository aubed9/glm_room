// server-https.ts - Next.js Standalone + Socket.IO with HTTPS
import { setupSocket } from '@/lib/socket';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const httpsPort = 3443;
const hostname = '0.0.0.0';

// HTTPS server for microphone access
async function createHttpsServer() {
  try {
    // Create Next.js app
    const nextApp = next({ 
      dev,
      dir: process.cwd(),
      conf: dev ? undefined : { distDir: './.next' }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    // Load SSL certificates
    const options = {
      key: readFileSync('./certs/key.pem'),
      cert: readFileSync('./certs/cert.pem')
    };

    // Create HTTPS server
    const server = createHttpsServer(options, (req, res) => {
      // Skip socket.io requests from Next.js handler
      if (req.url?.startsWith('/api/socketio')) {
        return;
      }
      handle(req, res);
    });

    // Setup Socket.IO
    const io = new Server(server, {
      path: '/api/socketio',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    setupSocket(io);

    // Start the HTTPS server
    server.listen(httpsPort, hostname, () => {
      console.log(`> HTTPS Ready on https://${hostname}:${httpsPort}`);
      console.log(`> Socket.IO server running at wss://${hostname}:${httpsPort}/api/socketio`);
      console.log(`> For microphone access, use: https://localhost:${httpsPort}`);
    });

  } catch (err) {
    console.error('HTTPS Server startup error:', err);
    process.exit(1);
  }
}

// Start the HTTPS server
createHttpsServer();