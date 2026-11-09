import request from 'supertest';
import { createPrismaMock } from '../../test/mock-prisma.js';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma.js', () => ({
  prisma: mockPrisma,
}));

import { app } from '../../app.js';
import { authService } from '../auth/auth.service.js';
import { terraformService } from './terraform.service.js';
import { Role } from '@prisma/client';

describe('Terraform Infrastructure Generation Engine', () => {
  let teamId: string;
  let devToken: string;
  let leadToken: string;
  let devId: string;
  let serviceId: string;

  beforeAll(async () => {
    const team = await mockPrisma.team.create({
      data: { name: 'Infra Core Team', slug: 'infra-core' },
    });
    teamId = team.id;

    const hash = await authService.hashPassword('Password123!');

    const dev = await mockPrisma.user.create({
      data: {
        email: `dev.tf.${Date.now()}@idp.internal`,
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

    const lead = await mockPrisma.user.create({
      data: {
        email: `lead.tf.${Date.now()}@idp.internal`,
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

    const service = await mockPrisma.service.create({
      data: {
        name: 'payment-gateway',
        stack: 'node-express',
        teamId,
        ownerId: devId,
        repoUrl: 'https://github.com/systemwithayush/payment-gateway',
        imageRepo: 'ghcr.io/systemwithayush/payment-gateway',
      },
    });
    serviceId = service.id;

    await mockPrisma.environment.create({
      data: {
        serviceId,
        type: 'prod',
        k8sNamespace: 'idp-payment-gateway-prod',
        replicas: 3,
        cpuRequestM: 500,
        memoryRequestMb: 1024,
      },
    });
  });

  describe('TerraformService Unit Tests', () => {
    it('generates multi-file GCP Terraform modules correctly', async () => {
      const module = await terraformService.generateModule(serviceId, {
        cloudProvider: 'gcp',
        environment: 'prod',
        enableDatabase: true,
        enableStorage: true,
      });

      expect(module.serviceId).toBe(serviceId);
      expect(module.cloudProvider).toBe('gcp');
      expect(module.validated).toBe(true);

      expect(module.files['versions.tf']).toContain('hashicorp/google');
      expect(module.files['variables.tf']).toContain('variable "replicas"');
      expect(module.files['main.tf']).toContain('payment-gateway');
      expect(module.files['main.tf']).toContain('kubernetes_deployment');
      expect(module.files['database.tf']).toContain('google_sql_database_instance');
      expect(module.files['storage.tf']).toContain('google_storage_bucket');
      expect(module.files['outputs.tf']).toContain('service_internal_endpoint');
    });

    it('generates AWS Terraform modules when requested', async () => {
      const module = await terraformService.generateModule(serviceId, {
        cloudProvider: 'aws',
        environment: 'staging',
        enableDatabase: true,
        enableStorage: true,
      });

      expect(module.cloudProvider).toBe('aws');
      expect(module.files['versions.tf']).toContain('hashicorp/aws');
      expect(module.files['database.tf']).toContain('aws_db_instance');
      expect(module.files['storage.tf']).toContain('aws_s3_bucket');
    });

    it('omits database and storage resources when disabled', async () => {
      const module = await terraformService.generateModule(serviceId, {
        cloudProvider: 'gcp',
        enableDatabase: false,
        enableStorage: false,
      });

      expect(module.files['database.tf']).toBeUndefined();
      expect(module.files['storage.tf']).toBeUndefined();
      expect(module.files['main.tf']).toBeDefined();
    });

    it('throws 404 when service does not exist', async () => {
      await expect(
        terraformService.generateModule('non-existent-uuid')
      ).rejects.toThrow('Service not found');
    });

    it('fetches existing module record from database', async () => {
      const existing = await terraformService.getModule(serviceId);
      expect(existing.serviceId).toBe(serviceId);
      expect(existing.validated).toBe(true);
      expect(existing.combinedHcl).toContain('payment-gateway');
    });
  });

  describe('Terraform API Endpoints', () => {
    it('POST /api/v1/services/:id/terraform generates and saves HCL', async () => {
      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/terraform`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          cloudProvider: 'gcp',
          environment: 'prod',
          enableDatabase: true,
          enableStorage: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.files).toBeDefined();
      expect(res.body.combinedHcl).toContain('google_sql_database_instance');
    });

    it('GET /api/v1/services/:id/terraform returns generated module', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${serviceId}/terraform`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.serviceId).toBe(serviceId);
      expect(res.body.combinedHcl).toBeDefined();
    });

    it('GET /api/v1/services/:id/terraform/download downloads combined .tf bundle', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${serviceId}/terraform/download`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('payment-gateway-infrastructure.tf');
      expect(res.text).toContain('terraform {');
    });

    it('GET /api/v1/services/:id/terraform/download?file=main.tf downloads single file', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${serviceId}/terraform/download?file=main.tf`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment; filename="main.tf"');
      expect(res.text).toContain('kubernetes_deployment');
    });

    it('returns 404 for non-existent service', async () => {
      const res = await request(app)
        .post('/api/v1/services/non-existent-service/terraform')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({});

      expect(res.status).toBe(404);
    });
  });
});
