import { z } from 'zod';

export const RoleSchema = z.enum(['admin', 'lead', 'developer']);
export const EnvironmentTypeSchema = z.enum(['dev', 'staging', 'prod']);
export const DeploymentStatusSchema = z.enum([
  'requested',
  'building',
  'pushed',
  'applying',
  'rolling_out',
  'succeeded',
  'failed',
  'rolled_back',
]);

// Auth Schemas
export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  teamId: z.string().uuid(),
  role: RoleSchema.default('developer'),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

// Service Schemas
export const CreateServiceSchema = z.object({
  name: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/, 'Service name must be lowercase alphanumeric and dashes'),
  stack: z.string().min(1),
  repoUrl: z.string().url(),
  imageRepo: z.string().min(1),
  templateId: z.string().uuid().optional(),
});

// Environment Schemas
export const CreateEnvironmentSchema = z.object({
  type: EnvironmentTypeSchema,
  k8sNamespace: z.string().min(1).max(63),
  replicas: z.number().int().min(1).max(30).default(1),
  cpuRequestM: z.number().int().min(50).max(8000).default(100),
  memoryRequestMb: z.number().int().min(64).max(32768).default(128),
});

// Env Variables Schemas
export const UpsertEnvVariableSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z0-9_]+$/, 'Environment keys must be uppercase alphanumeric and underscores'),
  value: z.string(),
  isSecret: z.boolean().default(false),
});

export const UpsertEnvVariablesBatchSchema = z.object({
  variables: z.array(UpsertEnvVariableSchema),
});

// Deployment Schemas
export const CreateDeploymentSchema = z.object({
  serviceId: z.string().uuid(),
  environmentId: z.string().uuid(),
  gitSha: z.string().min(7).max(40),
  imageTag: z.string().min(1),
});

export const RollbackDeploymentSchema = z.object({
  rollbackOfId: z.string().uuid(),
});

// AI Recommendation Schemas
export const AIRecommendationOutputSchema = z.object({
  cpu_request_m: z.number().int().min(50),
  cpu_limit_m: z.number().int().min(50),
  memory_request_mb: z.number().int().min(64),
  memory_limit_mb: z.number().int().min(64),
  replicas: z.number().int().min(1).max(20),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(z.string().min(1)),
});

