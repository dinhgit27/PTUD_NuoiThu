import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

import authRouter from './routes/auth';
import petRouter from './routes/pet';
import adminRouter from './routes/admin';
import musicRouter from './routes/music';
import gardenRouter from './routes/garden';
import departmentsRouter from './routes/departments';
import shopRouter from './routes/shop';
import friendsRouter from './routes/friends';
import questsRouter from './routes/quests';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static assets (pixel art sprite sheets, backgrounds, audio)
const publicDir = path.resolve(process.cwd(), 'public');
const rootPublicDir = path.resolve(process.cwd(), '..', 'public');
app.use(express.static(publicDir));
app.use('/sprites', express.static(path.join(publicDir, 'sprites')));
app.use('/backgrounds', express.static(path.join(publicDir, 'backgrounds')));
app.use('/audio', express.static(path.join(publicDir, 'audio')));

if (fs.existsSync(rootPublicDir) && rootPublicDir !== publicDir) {
  app.use(express.static(rootPublicDir));
  app.use('/sprites', express.static(path.join(rootPublicDir, 'sprites')));
  app.use('/backgrounds', express.static(path.join(rootPublicDir, 'backgrounds')));
  app.use('/audio', express.static(path.join(rootPublicDir, 'audio')));
}

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/pet', petRouter);
app.use('/api/admin', adminRouter);
app.use('/api/music', musicRouter);
app.use('/api/garden', gardenRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/shop', shopRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/quests', questsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'OfficePet 2D Pixel Platform',
    timestamp: new Date().toISOString()
  });
});

// Socket.io Real-time Shared Garden & Pet State Sync
io.on('connection', (socket) => {
  console.log('⚡ Socket client connected:', socket.id);

  // Join User Private Room (for Direct Messages & Friend Updates)
  socket.on('join_user', (userId: string) => {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined user_${userId}`);
  });

  // Join Department Garden Room
  socket.on('join_garden', (deptId: string) => {
    socket.join(`garden_${deptId}`);
    console.log(`Socket ${socket.id} joined garden_${deptId}`);
  });

  // Broadcast Pet State / Position Update in Shared Garden
  socket.on('pet_update', (data: { deptId: string; petId: string; state: string; x?: number; y?: number }) => {
    socket.to(`garden_${data.deptId}`).emit('pet_updated', data);
  });

  // Broadcast Speech Bubble Message in Shared Garden
  socket.on('speech_bubble', (data: { deptId: string; petId: string; message: string; senderName: string }) => {
    io.to(`garden_${data.deptId}`).emit('speech_bubble_broadcast', data);
  });

  // Garden Level Up Announcement
  socket.on('garden_levelup', (data: { deptId: string; newLevel: number; buff: number }) => {
    io.to(`garden_${data.deptId}`).emit('garden_leveled_up', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 OfficePet Backend listening on http://localhost:${PORT}`);
});

export { app, server, io, prisma };
