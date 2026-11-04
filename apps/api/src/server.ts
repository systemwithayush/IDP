import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './prisma.js';

const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Socket.io client connected');

  socket.on('join', (room: string) => {
    socket.join(room);
    logger.info({ socketId: socket.id, room }, 'Socket joined room');
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Socket.io client disconnected');
  });
});

const serverInstance = server.listen(env.PORT, () => {
  logger.info(`🚀 IDP API Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  serverInstance.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database connection closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

