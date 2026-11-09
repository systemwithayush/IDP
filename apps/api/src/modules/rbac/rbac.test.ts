import request from 'supertest';
import { createPrismaMock } from '../../test/mock-prisma.js';

const mockPrisma = createPrismaMock();

// Mock prisma client before app is imported
jest.mock('../../prisma.js', () => ({
  prisma: mockPrisma,
}));

import { app } from '../../app.js';
import { authService } from '../auth/auth.service.js';
import { auditService } from '../audit/audit.service.js';
import { requireServiceAccess } from '../../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

describe('RBAC & Audit Integration Tests', () => {
  let team1Id: string;
  let team2Id: string;
  let adminToken: string;
  let lead1Token: string;
  let dev1Token: string;
  let dev2Token: string;
  let dev1Id: string;
  let dev2Id: string;
  let testServiceId: string;

  beforeAll(async () => {
    // Setup 2 Teams
    const t1 = await mockPrisma.team.upsert({
      where: { slug: 'team-alpha-rbac' },
      update: {},
      create: { name: 'Team Alpha RBAC', slug: 'team-alpha-rbac' },
    });
    team1Id = t1.id;

    await mockPrisma.resourceQuota.create({
      data: {
        teamId: team1Id,
        maxCpuMillicores: 16000,
        maxMemoryMb: 32768,
        maxServices: 10,
      },
    });

    const t2 = await mockPrisma.team.upsert({
      where: { slug: 'team-beta-rbac' },
      update: {},
      create: { name: 'Team Beta RBAC', slug: 'team-beta-rbac' },
    });
    team2Id = t2.id;

    // Password hash
    const passwordHash = await authService.hashPassword('Password123!');

    // Create Admin
    const admin = await mockPrisma.user.create({
      data: {
        email: `admin.rbac.${Date.now()}@idp.internal`,
        passwordHash,
        role: Role.admin,
        teamId: team1Id,
      },
    });
    adminToken = authService.generateTokens({
      id: admin.id,
      email: admin.email,
      role: Role.admin,
      teamId: team1Id,
    }).accessToken;

    // Create Lead (Team 1)
    const lead1 = await mockPrisma.user.create({
      data: {
        email: `lead.rbac.${Date.now()}@idp.internal`,
        passwordHash,
        role: Role.lead,
        teamId: team1Id,
      },
    });
    lead1Token = authService.generateTokens({
      id: lead1.id,
      email: lead1.email,
      role: Role.lead,
      teamId: team1Id,
    }).accessToken;

    // Create Developer 1 (Team 1)
    const dev1 = await mockPrisma.user.create({
      data: {
        email: `dev1.rbac.${Date.now()}@idp.internal`,
        passwordHash,
        role: Role.developer,
        teamId: team1Id,
      },
    });
    dev1Id = dev1.id;
    dev1Token = authService.generateTokens({
      id: dev1.id,
      email: dev1.email,
      role: Role.developer,
      teamId: team1Id,
    }).accessToken;

    // Create Developer 2 (Team 2)
    const dev2 = await mockPrisma.user.create({
      data: {
        email: `dev2.rbac.${Date.now()}@idp.internal`,
        passwordHash,
        role: Role.developer,
        teamId: team2Id,
      },
    });
    dev2Id = dev2.id;
    dev2Token = authService.generateTokens({
      id: dev2.id,
      email: dev2.email,
      role: Role.developer,
      teamId: team2Id,
    }).accessToken;

    // Create Service owned by Dev 1 in Team 1
    const service = await mockPrisma.service.create({
      data: {
        name: `service-rbac-${Date.now()}`,
        stack: 'node-express',
        repoUrl: 'https://github.com/systemwithayush/test-svc',
        imageRepo: 'ghcr.io/systemwithayush/test-svc',
        teamId: team1Id,
        ownerId: dev1Id,
      },
    });
    testServiceId = service.id;
  });

  afterAll(async () => {
    await mockPrisma.auditLog.deleteMany({});
    await mockPrisma.service.deleteMany({
      where: { id: testServiceId },
    });
    await mockPrisma.user.deleteMany({});
    await mockPrisma.team.deleteMany({
      where: { id: { in: [team1Id, team2Id] } },
    });
    await mockPrisma.$disconnect();
  });

  describe('Route RBAC Matrix on Audit Logs (/api/v1/audit-log)', () => {
    it('denies unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/audit-log');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('allows Admin to view all audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('allows Lead to view scoped audit logs for their team', async () => {
      const res = await request(app)
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${lead1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('denies Developer role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${dev1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Teams API & Usage Isolation (/api/v1/teams)', () => {
    it('allows authenticated users to list teams', async () => {
      const res = await request(app)
        .get('/api/v1/teams')
        .set('Authorization', `Bearer ${dev1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('allows Admin to view any team usage', async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${team2Id}/usage`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.team.id).toBe(team2Id);
      expect(res.body).toHaveProperty('usage');
    });

    it('allows Lead to view own team usage', async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${team1Id}/usage`)
        .set('Authorization', `Bearer ${lead1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.team.id).toBe(team1Id);
    });

    it('denies Lead from viewing another team usage with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${team2Id}/usage`)
        .set('Authorization', `Bearer ${lead1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies Developer from viewing another team usage with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${team1Id}/usage`)
        .set('Authorization', `Bearer ${dev2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 when team usage is requested for non-existent team', async () => {
      const res = await request(app)
        .get('/api/v1/teams/non-existent-team-id/usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TEAM_NOT_FOUND');
    });
  });

  describe('Fine-Grained Service Access Middleware (requireServiceAccess)', () => {
    it('allows Admin full access to any service', async () => {
      const req: any = { user: { role: Role.admin }, params: { id: testServiceId }, body: {} };
      const res: any = {};
      const next = jest.fn();

      const middleware = requireServiceAccess('deploy');
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows Lead to access own team service', async () => {
      const req: any = { user: { role: Role.lead, teamId: team1Id }, params: { id: testServiceId }, body: {} };
      const res: any = {};
      const next = jest.fn();

      const middleware = requireServiceAccess('write');
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('blocks Developer from deploying service owned by another team', async () => {
      const req: any = { user: { role: Role.developer, teamId: team2Id, id: dev2Id }, params: { id: testServiceId }, body: {} };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = requireServiceAccess('write');
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows Developer owner to deploy to dev environment', async () => {
      const req: any = {
        user: { role: Role.developer, teamId: team1Id, id: dev1Id },
        params: { id: testServiceId },
        body: { envType: 'dev' },
      };
      const res: any = {};
      const next = jest.fn();

      const middleware = requireServiceAccess('deploy');
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows Developer to read service in own team', async () => {
      const req: any = {
        user: { role: Role.developer, teamId: team1Id, id: dev1Id },
        params: { id: testServiceId },
      };
      const res: any = {};
      const next = jest.fn();

      const middleware = requireServiceAccess('read');
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('returns 404 if service is not found in requireServiceAccess', async () => {
      const req: any = {
        user: { role: Role.developer, teamId: team1Id, id: dev1Id },
        params: { id: '00000000-0000-0000-0000-000000000000' },
      };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = requireServiceAccess('read');
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('blocks Developer from modifying service they do not own', async () => {
      // Create a service owned by another developer in team 1
      const anotherSvc = await mockPrisma.service.create({
        data: {
          name: `svc-other-${Date.now()}`,
          stack: 'node-express',
          repoUrl: 'https://github.com/systemwithayush/test',
          imageRepo: 'ghcr.io/systemwithayush/test',
          teamId: team1Id,
          ownerId: 'another-user-id',
        },
      });

      const req: any = {
        user: { role: Role.developer, teamId: team1Id, id: dev1Id },
        params: { id: anotherSvc.id },
      };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = requireServiceAccess('write');
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('blocks Developer from deploying to production (Lead required)', async () => {
      const req: any = {
        user: { role: Role.developer, teamId: team1Id, id: dev1Id },
        params: { id: testServiceId },
        body: { envType: 'prod' },
      };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = requireServiceAccess('deploy');
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Audit Service Direct Testing', () => {
    it('retrieves audit logs with filter', async () => {
      const logs = await auditService.getAuditLogs({ entityType: 'User', limit: 10 });
      expect(Array.isArray(logs)).toBe(true);
    });
  });
});
