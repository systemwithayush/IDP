import { prisma } from '../../prisma.js';
import { logger } from '../../utils/logger.js';
import { quotaValidator } from '../quotas/quota.validator.js';
import { terraformService } from '../terraform/terraform.service.js';

export interface ScaffoldOptions {
  templateId: string;
  serviceName: string;
  teamId: string;
  userId: string;
  repoUrl?: string;
  imageRepo?: string;
  initialEnvironment?: 'dev' | 'staging' | 'prod';
  autoRegister?: boolean;
}

export interface ScaffoldResult {
  serviceId?: string;
  serviceName: string;
  stack: string;
  files: Record<string, string>;
  registered: boolean;
  instructions: string[];
}

export class ScaffoldService {
  async scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult> {
    const {
      templateId,
      serviceName,
      teamId,
      userId,
      repoUrl = `https://github.com/systemwithayush/${opts.serviceName}`,
      imageRepo = `ghcr.io/systemwithayush/${opts.serviceName}`,
      initialEnvironment = 'dev',
      autoRegister = true,
    } = opts;

    // Validate service name format
    if (!/^[a-z0-9-]+$/.test(serviceName)) {
      const err = new Error('Service name must contain only lowercase letters, numbers, and hyphens');
      (err as any).status = 400;
      throw err;
    }

    // 1. Fetch template
    let template = await prisma.goldenPathTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      // Try finding by name or stack
      const all = await prisma.goldenPathTemplate.findMany();
      template = all.find(t => t.id === templateId || t.name.toLowerCase() === templateId.toLowerCase() || t.stack.toLowerCase() === templateId.toLowerCase()) || null;
    }

    if (!template) {
      const err = new Error(`Golden Path template '${templateId}' not found`);
      (err as any).status = 404;
      throw err;
    }

    const namespace = `idp-${serviceName}-${initialEnvironment}`;

    // 2. Interpolate files
    const dockerfile = (template.dockerfileTpl || '')
      .replace(/{{SERVICE_NAME}}/g, serviceName)
      .replace(/{{STACK}}/g, template.stack);

    const k8sManifest = (template.k8sManifestTpl || '')
      .replace(/{{SERVICE_NAME}}/g, serviceName)
      .replace(/{{K8S_NAMESPACE}}/g, namespace)
      .replace(/{{REPLICAS}}/g, '1')
      .replace(/{{IMAGE_REPO}}/g, imageRepo)
      .replace(/{{IMAGE_TAG}}/g, 'latest')
      .replace(/{{CPU_REQUEST_M}}/g, '100')
      .replace(/{{MEMORY_REQUEST_MB}}/g, '128');

    const githubWorkflow = `name: Deploy Service via IDP

run-name: "Deploy [\${{ inputs.correlation_id }}] - \${{ github.sha }}"

on:
  workflow_dispatch:
    inputs:
      correlation_id:
        description: "Unique correlation ID assigned by IDP"
        required: true
        type: string
      image_tag:
        description: "Target image tag"
        required: true
        type: string
      environment:
        description: "Target environment (dev, staging, prod)"
        required: true
        type: string

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build-and-push:
    name: Build & Push Container Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Log into GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=\${{ inputs.image_tag }}
            type=sha,format=long

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
`;

    const files: Record<string, string> = {
      'Dockerfile': dockerfile,
      'k8s.yaml': k8sManifest,
      '.github/workflows/deploy.yml': githubWorkflow,
      'README.md': `# ${serviceName}\n\nScaffolded from Golden Path: ${template.name} (${template.stack})\n\n## Quick Start\n\`\`\`bash\ndocker build -t ${imageRepo}:latest .\ndocker run -p 3000:3000 ${imageRepo}:latest\n\`\`\`\n`,
    };

    let createdServiceId: string | undefined;

    // 3. Auto-registration in IDP
    if (autoRegister) {
      // Validate quota
      await quotaValidator.validateServiceQuota(teamId);

      const service = await prisma.service.create({
        data: {
          name: serviceName,
          stack: template.stack,
          teamId,
          ownerId: userId,
          templateId: template.id,
          repoUrl,
          imageRepo,
          environments: {
            create: {
              type: initialEnvironment as any,
              k8sNamespace: namespace,
              replicas: 1,
              cpuRequestM: 100,
              memoryRequestMb: 128,
            },
          },
        },
      });

      createdServiceId = service.id;

      // Pre-generate Terraform modules
      try {
        const tf = await terraformService.generateModule(service.id, {
          environment: initialEnvironment,
        });
        files['infrastructure.tf'] = tf.combinedHcl;
      } catch (tfErr) {
        logger.warn({ error: tfErr }, 'Could not pre-generate terraform module during scaffolding');
      }

      // Record audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SERVICE_SCAFFOLDED',
          entityType: 'Service',
          entityId: service.id,
          metadata: {
            templateId: template.id,
            templateName: template.name,
            stack: template.stack,
            serviceName,
            initialEnvironment,
          },
        },
      });
    }

    return {
      serviceId: createdServiceId,
      serviceName,
      stack: template.stack,
      files,
      registered: autoRegister,
      instructions: [
        `Clone or initialize git repository: git init && git remote add origin ${repoUrl}`,
        `Commit scaffolded files: git add . && git commit -m "feat: initial service scaffold from ${template.name}"`,
        `Push to remote: git push -u origin main`,
        `Trigger deployment in IDP portal to launch to ${initialEnvironment}`,
      ],
    };
  }
}

export const scaffoldService = new ScaffoldService();
