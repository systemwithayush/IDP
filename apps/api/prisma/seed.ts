import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing records in reverse dependency order
  await prisma.auditLog.deleteMany({});
  await prisma.terraformModule.deleteMany({});
  await prisma.aIRecommendation.deleteMany({});
  await prisma.pipelineRun.deleteMany({});
  await prisma.deploymentEvent.deleteMany({});
  await prisma.deployment.deleteMany({});
  await prisma.envVariable.deleteMany({});
  await prisma.environment.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.goldenPathTemplate.deleteMany({});
  await prisma.resourceQuota.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.team.deleteMany({});

  // 1. Teams
  const platformTeam = await prisma.team.create({
    data: {
      name: 'Platform Engineering',
      slug: 'platform-engineering',
    },
  });

  const productTeam = await prisma.team.create({
    data: {
      name: 'Payments & Checkout',
      slug: 'payments-checkout',
    },
  });

  console.log('✅ Teams created');

  // 2. Resource Quotas
  await prisma.resourceQuota.create({
    data: {
      teamId: platformTeam.id,
      maxCpuMillicores: 16000,
      maxMemoryMb: 32768,
      maxServices: 10,
    },
  });

  await prisma.resourceQuota.create({
    data: {
      teamId: productTeam.id,
      maxCpuMillicores: 8000,
      maxMemoryMb: 16384,
      maxServices: 5,
    },
  });

  console.log('✅ Resource quotas created');

  // 3. Golden Path Templates
  const expressTpl = await prisma.goldenPathTemplate.create({
    data: {
      name: 'Node.js Express Microservice',
      stack: 'node-express',
      dockerfileTpl: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]`,
      k8sManifestTpl: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{SERVICE_NAME}}
  namespace: {{K8S_NAMESPACE}}
spec:
  replicas: {{REPLICAS}}
  selector:
    matchLabels:
      app: {{SERVICE_NAME}}
  template:
    metadata:
      labels:
        app: {{SERVICE_NAME}}
    spec:
      containers:
      - name: {{SERVICE_NAME}}
        image: {{IMAGE_REPO}}:{{IMAGE_TAG}}
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: "{{CPU_REQUEST_M}}m"
            memory: "{{MEMORY_REQUEST_MB}}Mi"`,
      terraformTpl: `module "service" {
  source = "./modules/service"
  name   = "{{SERVICE_NAME}}"
  tier   = "standard"
}`,
    },
  });

  const reactTpl = await prisma.goldenPathTemplate.create({
    data: {
      name: 'React Static Single Page App',
      stack: 'react-static',
      dockerfileTpl: `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
      k8sManifestTpl: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{SERVICE_NAME}}
  namespace: {{K8S_NAMESPACE}}
spec:
  replicas: {{REPLICAS}}
  selector:
    matchLabels:
      app: {{SERVICE_NAME}}
  template:
    metadata:
      labels:
        app: {{SERVICE_NAME}}
    spec:
      containers:
      - name: {{SERVICE_NAME}}
        image: {{IMAGE_REPO}}:{{IMAGE_TAG}}
        ports:
        - containerPort: 80`,
      terraformTpl: `module "static_site" {
  source = "./modules/spa"
  name   = "{{SERVICE_NAME}}"
}`,
    },
  });

  const fastapiTpl = await prisma.goldenPathTemplate.create({
    data: {
      name: 'Python FastAPI Async API',
      stack: 'python-fastapi',
      dockerfileTpl: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`,
      k8sManifestTpl: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{SERVICE_NAME}}
  namespace: {{K8S_NAMESPACE}}
spec:
  replicas: {{REPLICAS}}
  selector:
    matchLabels:
      app: {{SERVICE_NAME}}
  template:
    metadata:
      labels:
        app: {{SERVICE_NAME}}
    spec:
      containers:
      - name: {{SERVICE_NAME}}
        image: {{IMAGE_REPO}}:{{IMAGE_TAG}}
        ports:
        - containerPort: 8000`,
      terraformTpl: `module "fastapi" {
  source = "./modules/api"
  name   = "{{SERVICE_NAME}}"
}`,
    },
  });

  console.log('✅ Golden path templates created');

  // 4. Users
  // Shared easy password hash for test accounts: "password123"
  const passwordHash = await bcrypt.hash('password123', 10);

  const usersData = [
    // Primary Personas
    { email: 'divya@idp.internal', name: 'Divya', role: Role.admin, teamId: platformTeam.id },
    { email: 'deepak@idp.internal', name: 'Deepak', role: Role.lead, teamId: productTeam.id },
    { email: 'ayush@idp.internal', name: 'Ayush', role: Role.developer, teamId: productTeam.id },

    // Additional test users
    { email: 'admin1@idp.internal', name: 'Admin One', role: Role.admin, teamId: platformTeam.id },
    { email: 'lead.platform@idp.internal', name: 'Platform Lead', role: Role.lead, teamId: platformTeam.id },
    { email: 'dev.alice@idp.internal', name: 'Alice Developer', role: Role.developer, teamId: platformTeam.id },
  ];

  const createdUsers: Record<string, string> = {};
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        role: u.role,
        teamId: u.teamId,
      },
    });
    createdUsers[u.email] = user.id;
  }

  console.log('✅ 9 Users created across 3 roles');

  // 5. Initial Sample Services for verification
  const authService = await prisma.service.create({
    data: {
      name: 'auth-gateway',
      stack: 'node-express',
      repoUrl: 'https://github.com/systemwithayush/auth-gateway',
      imageRepo: 'ghcr.io/systemwithayush/auth-gateway',
      teamId: platformTeam.id,
      ownerId: createdUsers['ayush@idp.internal'] || createdUsers['divya@idp.internal'],
      templateId: expressTpl.id,
    },
  });

  const billingService = await prisma.service.create({
    data: {
      name: 'payment-processor',
      stack: 'python-fastapi',
      repoUrl: 'https://github.com/systemwithayush/payment-processor',
      imageRepo: 'ghcr.io/systemwithayush/payment-processor',
      teamId: productTeam.id,
      ownerId: createdUsers['deepak@idp.internal'] || createdUsers['ayush@idp.internal'],
      templateId: fastapiTpl.id,
    },
  });

  // Environments
  await prisma.environment.create({
    data: {
      serviceId: authService.id,
      type: 'dev',
      k8sNamespace: 'idp-platform-dev',
      replicas: 1,
      cpuRequestM: 100,
      memoryRequestMb: 128,
    },
  });

  await prisma.environment.create({
    data: {
      serviceId: authService.id,
      type: 'prod',
      k8sNamespace: 'idp-platform-prod',
      replicas: 2,
      cpuRequestM: 500,
      memoryRequestMb: 512,
    },
  });

  console.log('✅ Sample services and environments created');
  console.log('🚀 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

