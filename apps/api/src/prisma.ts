import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger.js';

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
        ]
      : ['error'],
});

if (process.env.NODE_ENV === 'development') {
  // @ts-ignore Prisma event typing
  prisma.$on('error', (e: unknown) => {
    logger.error({ err: e }, 'Prisma error');
  });
}

