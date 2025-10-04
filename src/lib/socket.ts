import { Server } from 'socket.io';

interface RoomParticipant {
  userId: string;
  userName: string;
  socketId: string;
  isRecording: boolean;
}

const roomParticipants = new Map<string, RoomParticipant[]>();

export const setupSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, 'from:', socket.handshake.headers.origin);
    
    // Join room
    socket.on('join-room', (data: { roomId: string; userId: string; userName: string }) => {
      const { roomId, userId, userName } = data;
      console.log(`User ${userName} (${userId}) joining room ${roomId}`);
      
      // Join socket room
      socket.join(roomId);
      
      // Add participant to room
      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, []);
      }
      
      const participants = roomParticipants.get(roomId)!;
      const existingParticipant = participants.find(p => p.userId === userId);
      
      if (!existingParticipant) {
        participants.push({
          userId,
          userName,
          socketId: socket.id,
          isRecording: false
        });
      }
      
      // Notify all participants
      io.to(roomId).emit('participants-updated', participants);
      console.log(`Room ${roomId} now has ${participants.length} participants`);
    });
    
    // Recording started
    socket.on('recording-started', (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;
      console.log(`User ${userId} started recording in room ${roomId}`);
      const participants = roomParticipants.get(roomId);
      
      if (participants) {
        const participant = participants.find(p => p.userId === userId);
        if (participant) {
          participant.isRecording = true;
        }
        
        // Notify all participants with creator information
        io.to(roomId).emit('recording-started', { userId });
        io.to(roomId).emit('participants-updated', participants);
      }
    });
    
    // Recording stopped
    socket.on('recording-stopped', (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;
      console.log(`User ${userId} stopped recording in room ${roomId}`);
      const participants = roomParticipants.get(roomId);
      
      if (participants) {
        const participant = participants.find(p => p.userId === userId);
        if (participant) {
          participant.isRecording = false;
        }
        
        // Notify all participants with creator information
        io.to(roomId).emit('recording-stopped', { userId });
        io.to(roomId).emit('participants-updated', participants);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', socket.id, 'reason:', reason);
      
      // Remove participant from all rooms
      roomParticipants.forEach((participants, roomId) => {
        const index = participants.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          const removedParticipant = participants[index];
          participants.splice(index, 1);
          io.to(roomId).emit('participants-updated', participants);
          console.log(`User ${removedParticipant.userName} left room ${roomId}`);
        }
      });
    });
  });
};