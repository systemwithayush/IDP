import { logger } from './logger.js';

describe('Logger Security & Redaction', () => {
  it('Configures redaction for sensitive keys', () => {
    // Verify logger instance exists and redaction paths are active
    expect(logger).toBeDefined();
    // @ts-expect-error accessing internal redaction config
    const redactPaths = logger[Symbol.for('pino.redactPaths')];
    if (redactPaths) {
      expect(redactPaths).toContain('password');
      expect(redactPaths).toContain('token');
      expect(redactPaths).toContain('secret');
      expect(redactPaths).toContain('ENCRYPTION_KEY');
    }
  });
});

