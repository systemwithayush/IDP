import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints.
 * Limits each IP to 10 requests per minute to prevent brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 1 minute.',
    },
  },
  skip: () => process.env.NODE_ENV === 'test', // Skip in automated tests to prevent false positives
});
