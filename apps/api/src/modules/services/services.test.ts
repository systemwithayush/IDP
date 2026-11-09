import request from 'supertest';
import { createPrismaMock } from '../../test/mock-prisma.js';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma.js', () => ({
  prisma: mockPrisma,
}));

import { app } from '../../app.js';
import { authService } from '../auth/auth.service.js';
import { quotaValidator } from '../quotas/quota.validator.js';
import { Role } from '@prisma/client';

describe('Services & Environment Modules Integration Tests', () => {
  let teamId: string;
  let devToken: string;
  let leadToken: string;
  let serviceId: string;
  let environmentId: string;

  beforeAll(async () => {
    // 1. Create Team with strict quota (max 2 services, max 500m CPU, 1024MB RAM)
    const team = await mockPrisma.team.create({
      data: {
        name: 'Service Test Team',
        slug: 'service-test-team',
      },
    });
    teamId = team.id;

    await mockPrisma.resourceQuota.create({
      data: {
        teamId,
        maxServices: 2,
        maxCpuMillicores: 500,
        maxMemoryMb: 1024,
      },
    });

    const hash = await authService.hashPassword('Password123!');

    // 2. Create Dev User
    const dev = await mockPrisma.user.create({
      data: {
        email: `dev.svc.${Date.now()}@idp.internal`,
        passwordHash: hash,
        role: Role.developer,
        teamId,
      },
    });
    devToken = authService.generateTokens({
      id: dev.id,
      email: dev.email,
      role: Role.developer,
      teamId,
    }).accessToken;

    // 3. Create Lead User
    const lead = await mockPrisma.user.create({
      data: {
        email: `lead.svc.${Date.now()}@idp.internal`,
        passwordHash: hash,
        role: Role.lead,
        teamId,
      },
    });
    leadToken = authService.generateTokens({
      id: lead.id,
      email: lead.email,
      role: Role.lead,
      teamId,
    }).accessToken;
  });

  afterAll(async () => {
    await mockPrisma.$disconnect();
  });

  describe('Service Creation & Quota Validation', () => {
    it('creates first service with dev environment successfully', async () => {
      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          name: 'first-microservice',
          stack: 'node-express',
          repoUrl: 'https://github.com/systemwithayush/first-svc',
          imageRepo: 'ghcr.io/systemwithayush/first-svc',
          initialEnvironment: {
            type: 'dev',
            replicas: 1,
            cpuRequestM: 100,
            memoryRequestMb: 256,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('first-microservice');
      serviceId = res.body.id;
      environmentId = res.body.environments[0].id;
    });

    it('creates second service successfully within quota limit', async () => {
      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          name: 'second-microservice',
          stack: 'python-fastapi',
          repoUrl: 'https://github.com/systemwithayush/second-svc',
          imageRepo: 'ghcr.io/systemwithayush/second-svc',
        });

      expect(res.status).toBe(201);
    });

    it('blocks creation of third service beyond max_services quota with 422', async () => {
      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          name: 'third-microservice',
          stack: 'react-static',
          repoUrl: 'https://github.com/systemwithayush/third-svc',
          imageRepo: 'ghcr.io/systemwithayush/third-svc',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(res.body.error.message).toContain('quota exceeded');
    });

    it('blocks environment sizing exceeding team CPU/Memory with 422', async () => {
      // Team max is 500m. Adding 600m should fail.
      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/environments`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          type: 'staging',
          k8sNamespace: 'idp-first-staging',
          replicas: 1,
          cpuRequestM: 600,
          memoryRequestMb: 256,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(res.body.error.message).toContain('CPU quota exceeded');
    });

    it('blocks environment sizing exceeding team Memory quota with 422', async () => {
      // Team max memory is 1024MB. Adding 2048MB should fail.
      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/environments`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          type: 'staging',
          k8sNamespace: 'idp-first-staging-mem',
          replicas: 1,
          cpuRequestM: 50,
          memoryRequestMb: 2048,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(res.body.error.message).toContain('Memory quota exceeded');
    });
  });

  describe('Encrypted Environment Variables & Secrets Store', () => {
    it('batch upserts environment variables with secrets encrypted', async () => {
      const res = await request(app)
        .put(`/api/v1/environments/${environmentId}/variables`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          variables: [
            { key: 'APP_PORT', value: '3000', isSecret: false },
            { key: 'DB_PASSWORD', value: 'secretPass123!', isSecret: true },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);

      const secretVar = res.body.find((v: any) => v.key === 'DB_PASSWORD');
      expect(secretVar.value).toBe('********');
    });

    it('GET /variables returns masked values for secrets', async () => {
      const res = await request(app)
        .get(`/api/v1/environments/${environmentId}/variables`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      const secretVar = res.body.find((v: any) => v.key === 'DB_PASSWORD');
      expect(secretVar.value).toBe('********');
      expect(secretVar.isSecret).toBe(true);

      const publicVar = res.body.find((v: any) => v.key === 'APP_PORT');
      expect(publicVar.value).toBe('3000');
    });

    it('denies Developer from revealing secrets with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/environments/${environmentId}/variables/reveal`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Lead to reveal secrets, returning decrypted plaintext and audit logging', async () => {
      const res = await request(app)
        .get(`/api/v1/environments/${environmentId}/variables/reveal`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      const secretVar = res.body.find((v: any) => v.key === 'DB_PASSWORD');
      expect(secretVar.value).toBe('secretPass123!');

      // Check audit log
      const audit = await mockPrisma.auditLog.findFirst({
        where: { action: 'REVEAL_SECRETS', entityId: environmentId },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe('Service CRUD Operations & Templates', () => {
    it('GET /api/v1/services lists services with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/services?search=first&stack=node-express')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 when adding environment to non-existent service', async () => {
      const res = await request(app)
        .post('/api/v1/services/00000000-0000-0000-0000-000000000000/environments')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          type: 'dev',
          k8sNamespace: 'idp-nonexistent-dev',
          replicas: 1,
          cpuRequestM: 100,
          memoryRequestMb: 128,
        });

      expect(res.status).toBe(404);
    });

    it('returns 404 when upserting variables for non-existent environment', async () => {
      const res = await request(app)
        .put('/api/v1/environments/00000000-0000-0000-0000-000000000000/variables')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          variables: [{ key: 'TEST', value: 'val', isSecret: false }],
        });

      expect(res.status).toBe(404);
    });

    it('GET /api/v1/services/:id retrieves service details', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(serviceId);
    });

    it('GET /api/v1/services/:id/environments lists environments', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${serviceId}/environments`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PATCH /api/v1/services/:id updates service metadata', async () => {
      const res = await request(app)
        .patch(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ repoUrl: 'https://github.com/systemwithayush/updated-svc' });

      expect(res.status).toBe(200);
      expect(res.body.repoUrl).toBe('https://github.com/systemwithayush/updated-svc');
    });

    it('GET /api/v1/templates lists golden path templates', async () => {
      const res = await request(app)
        .get('/api/v1/templates')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 404 for non-existent service ID', async () => {
      const res = await request(app)
        .get('/api/v1/services/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when querying variables for non-existent environment', async () => {
      const res = await request(app)
        .get('/api/v1/environments/00000000-0000-0000-0000-000000000000/variables')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when revealing variables for non-existent environment', async () => {
      const res = await request(app)
        .get('/api/v1/environments/00000000-0000-0000-0000-000000000000/variables/reveal')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(404);
    });

    it('quota validator succeeds when team has no quota configured or when resizing existing environment', async () => {
      await expect(quotaValidator.validateServiceQuota('team-no-quota-id')).resolves.toBeUndefined();
      await expect(
        quotaValidator.validateEnvironmentQuota({
          teamId,
          requestedCpuM: 50,
          requestedMemoryMb: 50,
          replicas: 1,
          existingEnvironmentId: environmentId,
        })
      ).resolves.toBeUndefined();
    });

    it('DELETE /api/v1/services/:id deletes service and audit logs', async () => {
      const res = await request(app)
        .delete(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('service');
    });
  });
});
