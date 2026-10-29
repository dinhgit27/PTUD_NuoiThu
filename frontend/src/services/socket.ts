import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const origin =
      typeof window !== 'undefined' && (window.location.protocol === 'file:' || (window as any).officePet)
        ? 'http://localhost:4000'
        : window.location.origin;

    socket = io(origin, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to OfficePet Real-time Socket Server:', socket?.id);
    });
  }
  return socket;
}

export function joinGardenRoom(deptId: string) {
  const s = getSocket();
  s.emit('join_garden', deptId);
}

export function broadcastPetUpdate(deptId: string, petId: string, state: string, x?: number, y?: number) {
  const s = getSocket();
  s.emit('pet_update', { deptId, petId, state, x, y });
}

export function broadcastSpeechBubble(deptId: string, petId: string, message: string, senderName: string) {
  const s = getSocket();
  s.emit('speech_bubble', { deptId, petId, message, senderName });
}
