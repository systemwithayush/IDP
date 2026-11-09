import request from 'supertest';
import crypto from 'crypto';
import { createPrismaMock } from '../../test/mock-prisma.js';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma.js', () => ({
  prisma: mockPrisma,
}));

import { app } from '../../app.js';
import { authService } from '../auth/auth.service.js';
import { gitHubService } from './github.service.js';
import { env } from '../../config/env.js';
import { Role } from '@prisma/client';

describe('Deployments & GitHub Actions Integration Tests', () => {
  let teamId: string;
  let devToken: string;
  let leadToken: string;
  let devId: string;
  let serviceId: string;
  let environmentId: string;
  let createdDeploymentId: string;
  let correlationId: string;

  beforeAll(async () => {
    // 1. Team
    const team = await mockPrisma.team.create({
      data: { name: 'Deploy Team', slug: 'deploy-team' },
    });
    teamId = team.id;

    const hash = await authService.hashPassword('Password123!');

    // 2. Developer
    const dev = await mockPrisma.user.create({
      data: {
        email: `dev.deploy.${Date.now()}@idp.internal`,
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

    // 3. Lead
    const lead = await mockPrisma.user.create({
      data: {
        email: `lead.deploy.${Date.now()}@idp.internal`,
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

    // 4. Service
    const service = await mockPrisma.service.create({
      data: {
        name: 'deployable-service',
        stack: 'node-express',
        repoUrl: 'https://github.com/systemwithayush/deployable-service',
        imageRepo: 'ghcr.io/systemwithayush/deployable-service',
        teamId,
        ownerId: devId,
      },
    });
    serviceId = service.id;

    // 5. Environment (dev)
    const envRecord = await mockPrisma.environment.create({
      data: {
        serviceId,
        type: 'dev',
        k8sNamespace: 'idp-deployable-dev',
        replicas: 1,
        cpuRequestM: 100,
        memoryRequestMb: 128,
      },
    });
    environmentId = envRecord.id;
  });

  afterAll(async () => {
    await mockPrisma.$disconnect();
  });

  describe('POST /api/v1/deployments (Trigger Workflow Dispatch)', () => {
    it('creates deployment, triggers GitHub Actions dispatch, and transitions to building', async () => {
      const res = await request(app)
        .post('/api/v1/deployments')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          serviceId,
          environmentId,
          gitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          imageTag: 'v1.0.0',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('correlationId');
      expect(res.body.status).toBe('building'); // After dispatch CI, it enters building
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);

      createdDeploymentId = res.body.id;
      correlationId = res.body.correlationId;
    });

    it('GET /api/v1/deployments/:id retrieves deployment details and timeline', async () => {
      const res = await request(app)
        .get(`/api/v1/deployments/${createdDeploymentId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdDeploymentId);
      expect(res.body.service.id).toBe(serviceId);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/services/:id/deployments returns deployment history for service', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${serviceId}/deployments`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/webhooks/github (HMAC Verification & Idempotency)', () => {
    it('verifies HMAC-signed webhook and advances state machine on workflow_run success', async () => {
      const payload = {
        action: 'completed',
        workflow_run: {
          id: 12345678,
          name: `Deploy [${correlationId}] - main`,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/systemwithayush/deployable-service/actions/runs/12345678',
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${crypto
        .createHmac('sha256', env.GITHUB_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')}`;

      const res = await request(app)
        .post('/api/v1/webhooks/github')
        .set('x-github-event', 'workflow_run')
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });

      // Verify deployment transitioned to pushed
      const updated = await mockPrisma.deployment.findUnique({
        where: { id: createdDeploymentId },
      });
      expect(updated?.status).toBe('pushed');
    });

    it('handles webhook replay idempotently without error', async () => {
      const payload = {
        action: 'completed',
        workflow_run: {
          id: 12345678,
          name: `Deploy [${correlationId}] - main`,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/systemwithayush/deployable-service/actions/runs/12345678',
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${crypto
        .createHmac('sha256', env.GITHUB_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')}`;

      // Duplicate delivery
      const res = await request(app)
        .post('/api/v1/webhooks/github')
        .set('x-github-event', 'workflow_run')
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(res.status).toBe(200);
    });

    it('HMAC signature verification rejects invalid signature', () => {
      const isValid = gitHubService.verifyWebhookSignature('payload', 'sha256=invalid-signature-1234');
      expect(isValid).toBe(false);
    });

    it('rejects webhook request with invalid signature with 401', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/github')
        .set('x-github-event', 'workflow_run')
        .set('x-hub-signature-256', 'sha256=badsignature00000000000000000000000000000000000000000000000000000000')
        .send({ test: 'invalid' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('handles failure workflow_run conclusion by transitioning to failed', async () => {
      const payload = {
        action: 'completed',
        workflow_run: {
          id: 99999999,
          name: `Deploy [${correlationId}] - main`,
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/systemwithayush/deployable-service/actions/runs/99999999',
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${crypto
        .createHmac('sha256', env.GITHUB_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')}`;

      const res = await request(app)
        .post('/api/v1/webhooks/github')
        .set('x-github-event', 'workflow_run')
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(res.status).toBe(200);

      const updated = await mockPrisma.deployment.findUnique({
        where: { id: createdDeploymentId },
      });
      expect(updated?.status).toBe('failed');
    });
  });

  describe('Error handling & Not Found scenarios', () => {
    it('returns 404 when querying nonexistent deployment', async () => {
      const res = await request(app)
        .get('/api/v1/deployments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 when deploying nonexistent service', async () => {
      const res = await request(app)
        .post('/api/v1/deployments')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          serviceId: '00000000-0000-0000-0000-000000000000',
          environmentId,
          gitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          imageTag: 'v1.0.0',
        });

      expect(res.status).toBe(404);
    });

    it('returns 404 when deploying nonexistent environment', async () => {
      const res = await request(app)
        .post('/api/v1/deployments')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          serviceId,
          environmentId: '00000000-0000-0000-0000-000000000000',
          gitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          imageTag: 'v1.0.0',
        });

      expect(res.status).toBe(404);
    });

    it('returns 404 when rolling back nonexistent deployment', async () => {
      const res = await request(app)
        .post('/api/v1/deployments/00000000-0000-0000-0000-000000000000/rollback')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/deployments/:id/rollback (Rollback Trigger)', () => {
    it('creates rollback deployment referencing original deployment', async () => {
      const res = await request(app)
        .post(`/api/v1/deployments/${createdDeploymentId}/rollback`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.rollbackOfId).toBe(createdDeploymentId);
      expect(res.body.status).toBe('building');
    });
  });
});
