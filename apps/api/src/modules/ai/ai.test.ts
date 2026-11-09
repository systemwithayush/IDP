import request from 'supertest';
import { createPrismaMock } from '../../test/mock-prisma.js';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma.js', () => ({
  prisma: mockPrisma,
}));

import { app } from '../../app.js';
import { authService } from '../auth/auth.service.js';
import { aiService } from './ai.service.js';
import { MockOpenAIClient } from './openai.client.js';
import { Role } from '@prisma/client';

describe('AI Infrastructure Advisory Engine Tests', () => {
  let teamId: string;
  let devToken: string;
  let leadToken: string;
  let devId: string;
  let leadId: string;
  let serviceId: string;
  let environmentId: string;
  let mockClient: MockOpenAIClient;

  beforeAll(async () => {
    mockClient = new MockOpenAIClient();
    aiService.setOpenAIClient(mockClient);

    const team = await mockPrisma.team.create({
      data: { name: 'AI Advisory Team', slug: 'ai-team' },
    });
    teamId = team.id;

    // Team quota
    await mockPrisma.resourceQuota.create({
      data: {
        teamId,
        maxServices: 10,
        maxCpuMillicores: 4000,
        maxMemoryMb: 8192,
      },
    });

    const hash = await authService.hashPassword('Password123!');

    // Developer
    const dev = await mockPrisma.user.create({
      data: {
        email: `dev.ai.${Date.now()}@idp.internal`,
        passwordHash: hash,
        role: Role.developer,
        teamId,
      },
    });
    devId = dev.id;
    devToken = authService.generateTokens({
      id: dev.id,
      email: dev.email,
      role: Role.developer,
      teamId,
    }).accessToken;

    // Lead
    const lead = await mockPrisma.user.create({
      data: {
        email: `lead.ai.${Date.now()}@idp.internal`,
        passwordHash: hash,
        role: Role.lead,
        teamId,
      },
    });
    leadId = lead.id;
    leadToken = authService.generateTokens({
      id: lead.id,
      email: lead.email,
      role: Role.lead,
      teamId,
    }).accessToken;

    // Service
    const service = await mockPrisma.service.create({
      data: {
        name: 'recommendable-service',
        stack: 'node-express',
        repoUrl: 'https://github.com/systemwithayush/recommendable-service',
        imageRepo: 'ghcr.io/systemwithayush/recommendable-service',
        teamId,
        ownerId: devId,
      },
    });
    serviceId = service.id;

    // Environment
    const envRecord = await mockPrisma.environment.create({
      data: {
        serviceId,
        type: 'dev',
        k8sNamespace: 'idp-rec-dev',
        replicas: 1,
        cpuRequestM: 200,
        memoryRequestMb: 256,
      },
    });
    environmentId = envRecord.id;
  });

  afterAll(async () => {
    await mockPrisma.$disconnect();
  });

  describe('POST /api/v1/services/:id/recommendations', () => {
    it('generates grounded recommendation diff based on workload metrics', async () => {
      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/recommendations`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ environmentId });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('pending');
      expect(res.body).toHaveProperty('current');
      expect(res.body).toHaveProperty('recommended');
      expect(res.body).toHaveProperty('inputMetrics');
      expect(res.body.recommended).toHaveProperty('cpu_request_m');
      expect(res.body.recommended).toHaveProperty('memory_request_mb');
      expect(res.body.recommended.reasoning.length).toBeGreaterThan(0);
    });

    it('retries once if first attempt fails schema validation', async () => {
      // Configure mock to fail once, then succeed on retry
      mockClient.failNextRequest = true;

      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/recommendations`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ environmentId });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('pending');
    });

    it('rejects with 502 if schema validation fails repeatedly after retry', async () => {
      const brokenClient = {
        generateRecommendation: jest.fn().mockResolvedValue({ invalid: 'schema-always' }),
      };
      aiService.setOpenAIClient(brokenClient as any);

      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/recommendations`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ environmentId });

      expect(res.status).toBe(502);
      expect(res.body.error.message).toContain('schema validation rejected after retry');

      // Restore working mock
      aiService.setOpenAIClient(mockClient);
    });

    it('returns 404 when requesting recommendation for nonexistent service', async () => {
      const res = await request(app)
        .post(`/api/v1/services/00000000-0000-0000-0000-000000000000/recommendations`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ environmentId });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/services/:id/recommendations', () => {
    it('lists all historical recommendations for service', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${serviceId}/recommendations`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/recommendations/:id/approve', () => {
    let pendingRecId: string;

    beforeEach(async () => {
      const rec = await aiService.generateRecommendation(serviceId, environmentId);
      pendingRecId = rec.id;
    });

    it('denies approval for developers (requires lead or admin)', async () => {
      const res = await request(app)
        .post(`/api/v1/recommendations/${pendingRecId}/approve`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(403);
    });

    it('allows lead to approve recommendation, updates environment config, and writes audit log', async () => {
      const res = await request(app)
        .post(`/api/v1/recommendations/${pendingRecId}/approve`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.recommendation.status).toBe('approved');
      expect(res.body.recommendation.reviewedBy).toBe(leadId);
      expect(res.body).toHaveProperty('updatedEnvironment');

      // Verify environment config was updated
      const updatedEnv = await mockPrisma.environment.findUnique({
        where: { id: environmentId },
      });
      expect(updatedEnv?.cpuRequestM).toBe(res.body.updatedEnvironment.cpuRequestM);

      // Verify immutable audit log record
      const auditLog = await mockPrisma.auditLog.findFirst({
        where: {
          action: 'APPROVE_AI_RECOMMENDATION',
          entityId: pendingRecId,
        },
      });
      expect(auditLog).toBeDefined();
    });

    it('rejects approval when recommendation is already approved', async () => {
      // First approval
      await request(app)
        .post(`/api/v1/recommendations/${pendingRecId}/approve`)
        .set('Authorization', `Bearer ${leadToken}`);

      // Second approval attempt
      const res = await request(app)
        .post(`/api/v1/recommendations/${pendingRecId}/approve`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Cannot approve recommendation with status 'approved'");
    });
  });

  describe('POST /api/v1/recommendations/:id/reject', () => {
    let pendingRecId: string;

    beforeEach(async () => {
      const rec = await aiService.generateRecommendation(serviceId, environmentId);
      pendingRecId = rec.id;
    });

    it('allows lead to reject recommendation with optional reason and writes audit log', async () => {
      const res = await request(app)
        .post(`/api/v1/recommendations/${pendingRecId}/reject`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ reason: 'Traffic peak anticipated this weekend, deferring downsize' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
      expect(res.body.reviewedBy).toBe(leadId);

      // Verify audit log record
      const auditLog = await mockPrisma.auditLog.findFirst({
        where: {
          action: 'REJECT_AI_RECOMMENDATION',
          entityId: pendingRecId,
        },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.metadata?.reason).toContain('Traffic peak anticipated');
    });

    it('returns 404 when rejecting nonexistent recommendation', async () => {
      const res = await request(app)
        .post('/api/v1/recommendations/00000000-0000-0000-0000-000000000000/reject')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(404);
    });

    it('rejects rejection when recommendation is already rejected', async () => {
      // First reject
      await request(app)
        .post(`/api/v1/recommendations/${pendingRecId}/reject`)
        .set('Authorization', `Bearer ${leadToken}`);

      // Second reject
      const res = await request(app)
        .post(`/api/v1/recommendations/${pendingRecId}/reject`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Cannot reject recommendation with status 'rejected'");
    });
  });

  describe('MockOpenAIClient scenario branches', () => {
    it('recommends scale up on high CPU and peak memory spikes', async () => {
      const rec = await mockClient.generateRecommendation({
        serviceName: 'heavy-worker',
        environmentType: 'staging',
        currentCpuRequestM: 100,
        currentMemoryRequestMb: 128,
        currentReplicas: 1,
        metrics: {
          p95CpuM: 85,
          avgCpuM: 70,
          maxCpuM: 95,
          p95MemoryMb: 90,
          avgMemoryMb: 80,
          maxMemoryMb: 120, // > 85% of 128
          sampleCount: 60,
        },
      });

      expect(rec.cpu_request_m).toBeGreaterThan(100);
      expect(rec.memory_request_mb).toBeGreaterThan(128);
      expect(rec.reasoning.some(r => r.includes('CPU throttling'))).toBe(true);
      expect(rec.reasoning.some(r => r.includes('OOMKilled'))).toBe(true);
    });

    it('recommends HA replica increase in production when current replicas is 1', async () => {
      const rec = await mockClient.generateRecommendation({
        serviceName: 'prod-gateway',
        environmentType: 'prod',
        currentCpuRequestM: 500,
        currentMemoryRequestMb: 1024,
        currentReplicas: 1,
        metrics: {
          p95CpuM: 250,
          avgCpuM: 200,
          maxCpuM: 300,
          p95MemoryMb: 512,
          avgMemoryMb: 400,
          maxMemoryMb: 600,
          sampleCount: 60,
        },
      });

      expect(rec.replicas).toBe(2);
      expect(rec.reasoning.some(r => r.includes('single point of failure'))).toBe(true);
    });
  });
});
