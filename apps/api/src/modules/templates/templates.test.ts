import request from 'supertest';
import { createPrismaMock } from '../../test/mock-prisma.js';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma.js', () => ({
  prisma: mockPrisma,
}));

import { app } from '../../app.js';
import { authService } from '../auth/auth.service.js';
import { Role } from '@prisma/client';

describe('Golden Path Templates & Scaffolding Engine', () => {
  let teamId: string;
  let devToken: string;
  let devId: string;
  let templateId: string;

  beforeAll(async () => {
    const team = await mockPrisma.team.create({
      data: { name: 'Scaffolding Team', slug: 'scaffold-team' },
    });
    teamId = team.id;

    // Team quota: allows 5 services
    await mockPrisma.resourceQuota.create({
      data: {
        teamId,
        maxServices: 5,
        maxCpuMillicores: 4000,
        maxMemoryMb: 8192,
      },
    });

    const hash = await authService.hashPassword('Password123!');
    const dev = await mockPrisma.user.create({
      data: {
        email: `dev.scaffold.${Date.now()}@idp.internal`,
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

    const tpl = {
      id: 'node-express-tpl',
      name: 'Node Express Microservice',
      stack: 'node-express',
      dockerfileTpl: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD ["node", "index.js"]',
      k8sManifestTpl: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {{SERVICE_NAME}}\n  namespace: {{K8S_NAMESPACE}}',
      terraformTpl: 'resource "kubernetes_deployment" "app" {}',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.store.goldenPathTemplates.push(tpl);
    templateId = tpl.id;
  });

  it('GET /api/v1/templates lists all registered Golden Path templates', async () => {
    const res = await request(app)
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].name).toBe('Node Express Microservice');
  });

  it('GET /api/v1/templates/:id returns specific template details', async () => {
    const res = await request(app)
      .get(`/api/v1/templates/${templateId}`)
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(templateId);
    expect(res.body.stack).toBe('node-express');
  });

  it('GET /api/v1/templates/:id returns 404 for invalid template id', async () => {
    const res = await request(app)
      .get('/api/v1/templates/unknown-id')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/v1/templates/:id/scaffold generates complete service repository bundle', async () => {
    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/scaffold`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        serviceName: 'order-service',
        initialEnvironment: 'staging',
      });

    expect(res.status).toBe(201);
    expect(res.body.serviceName).toBe('order-service');
    expect(res.body.registered).toBe(true);
    expect(res.body.files).toBeDefined();

    // Check interpolated files
    expect(res.body.files['Dockerfile']).toContain('FROM node:20-alpine');
    expect(res.body.files['k8s.yaml']).toContain('order-service');
    expect(res.body.files['k8s.yaml']).toContain('idp-order-service-staging');
    expect(res.body.files['.github/workflows/deploy.yml']).toContain('Deploy Service via IDP');
    expect(res.body.files['README.md']).toContain('# order-service');
    expect(res.body.instructions.length).toBeGreaterThan(0);
  });

  it('rejects invalid service name with special characters or capitals', async () => {
    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/scaffold`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        serviceName: 'Order_Service!',
      });

    expect(res.status).toBe(400);
  });

  it('rejects request without serviceName', async () => {
    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/scaffold`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces quota limits during auto-registration', async () => {
    // Fill up quota (limit is 5)
    const currentCount = mockPrisma.store.services.filter(s => s.teamId === teamId).length;
    for (let i = currentCount; i < 5; i++) {
      await mockPrisma.service.create({
        data: {
          name: `dummy-svc-${i}`,
          stack: 'node-express',
          teamId,
          ownerId: devId,
          repoUrl: `https://github.com/systemwithayush/dummy-${i}`,
          imageRepo: `ghcr.io/systemwithayush/dummy-${i}`,
        },
      });
    }

    // Now try to scaffold 6th service
    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/scaffold`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        serviceName: 'overflow-service',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
  });
});
