import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './prisma.js';
import { setSocketServer } from './socket.js';
import { authService } from './modules/auth/auth.service.js';

export const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
});

setSocketServer(io);

// Socket Handshake Authentication Middleware
io.use((socket, next) => {
  const token =
    (socket.handshake.auth?.token as string) ||
    (socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') as string);

  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }

  try {
    const user = authService.verifyAccessToken(token);
    socket.data.user = user;
    next();
  } catch (err: any) {
    return next(new Error(`Authentication error: ${err.message}`));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  logger.info({ socketId: socket.id, user: user?.email }, 'Socket.io client connected with authenticated session');

  socket.on('join', async (room: string) => {
    // Room-level authorization check for deployment rooms
    if (room.startsWith('deployment:')) {
      const deploymentId = room.split(':')[1];
      const dep = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: { service: true },
      });

      if (!dep) {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Deployment not found' });
        return;
      }

      // Check access: platform admins or matching teamId
      if (user.role !== 'admin' && dep.service.teamId !== user.teamId) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Unauthorized room access' });
        return;
      }
    }

    socket.join(room);
    logger.info({ socketId: socket.id, room, user: user?.email }, 'Socket joined authorized room');
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Socket.io client disconnected');
  });
});

let serverInstance: http.Server | null = null;

if (process.env.NODE_ENV !== 'test') {
  serverInstance = server.listen(env.PORT, () => {
    logger.info(`🚀 IDP API Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      logger.info('HTTP server closed.');
      await prisma.$disconnect();
      logger.info('Database connection closed.');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
