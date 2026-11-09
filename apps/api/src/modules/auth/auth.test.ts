import request from 'supertest';
import { createPrismaMock } from '../../test/mock-prisma.js';

const mockPrisma = createPrismaMock();

// Mock prisma client before app is imported
jest.mock('../../prisma.js', () => ({
  prisma: mockPrisma,
}));

import { app } from '../../app.js';

describe('Auth Module Integration Tests', () => {
  let testTeamId: string;
  const testEmail = `test.user.${Date.now()}@idp.internal`;
  const testPassword = 'Password123!';

  beforeAll(async () => {
    // Create test team
    const team = await mockPrisma.team.upsert({
      where: { slug: 'test-team-auth' },
      update: {},
      create: {
        name: 'Test Team Auth',
        slug: 'test-team-auth',
      },
    });
    testTeamId = team.id;
  });

  afterAll(async () => {
    await mockPrisma.auditLog.deleteMany({});
    await mockPrisma.user.deleteMany({
      where: { email: testEmail },
    });
    await mockPrisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and sets httpOnly refresh token cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          teamId: testTeamId,
          role: 'developer',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe('developer');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('refreshToken');
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');

      // Verify audit log entry was written
      const auditEntry = await mockPrisma.auditLog.findFirst({
        where: { action: 'USER_REGISTERED', entityId: res.body.user.id },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.entityType).toBe('User');
    });

    it('rejects duplicate email registration with 409', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          teamId: testTeamId,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('validates request payload with zod', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email-format',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('authenticates valid credentials, returns JWT access token, and sets cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.headers['set-cookie'][0]).toContain('refreshToken');

      // Verify audit log for login
      const auditEntry = await mockPrisma.auditLog.findFirst({
        where: { action: 'USER_LOGIN', entityId: res.body.user.id },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('rejects invalid password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@idp.internal',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/refresh & /logout', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      accessToken = loginRes.body.accessToken;
      const cookieHeader = loginRes.headers['set-cookie'][0];
      refreshToken = cookieHeader.split(';')[0].replace('refreshToken=', '');
    });

    it('rotates refresh token and issues new access token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.headers['set-cookie'][0]).toContain('refreshToken');
    });

    it('returns 401 when refresh token is missing', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_REFRESH_TOKEN');
    });

    it('GET /api/v1/auth/me returns current authenticated user details', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(testEmail);
      expect(res.body).toHaveProperty('team');
    });

    it('POST /api/v1/auth/logout clears cookie and audit logs the event', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['set-cookie'][0]).toContain('refreshToken=;');

      const auditEntry = await mockPrisma.auditLog.findFirst({
        where: { action: 'USER_LOGOUT' },
      });
      expect(auditEntry).not.toBeNull();
    });
  });
});
