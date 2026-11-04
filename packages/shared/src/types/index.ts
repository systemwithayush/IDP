export type Role = 'admin' | 'lead' | 'developer';

export type EnvironmentType = 'dev' | 'staging' | 'prod';

export type DeploymentStatus =
  | 'requested'
  | 'building'
  | 'pushed'
  | 'applying'
  | 'rolling_out'
  | 'succeeded'
  | 'failed'
  | 'rolled_back';

export type RecommendationStatus = 'pending' | 'approved' | 'rejected';

export interface UserSummary {
  id: string;
  teamId: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ResourceQuotaDTO {
  id: string;
  teamId: string;
  maxCpuMillicores: number;
  maxMemoryMb: number;
  maxServices: number;
}

export interface GoldenPathTemplateDTO {
  id: string;
  name: string;
  stack: string;
  dockerfileTpl: string;
  k8sManifestTpl: string;
  terraformTpl: string;
}

export interface ServiceDTO {
  id: string;
  teamId: string;
  ownerId: string;
  templateId?: string | null;
  name: string;
  stack: string;
  repoUrl: string;
  imageRepo: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentDTO {
  id: string;
  serviceId: string;
  type: EnvironmentType;
  k8sNamespace: string;
  replicas: number;
  cpuRequestM: number;
  memoryRequestMb: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentDTO {
  id: string;
  serviceId: string;
  environmentId: string;
  triggeredBy: string;
  rollbackOfId?: string | null;
  imageTag: string;
  gitSha: string;
  correlationId: string;
  status: DeploymentStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentEventDTO {
  id: string;
  deploymentId: string;
  fromStatus: string;
  toStatus: string;
  message: string;
  createdAt: string;
}

export interface AIRecommendationDTO {
  id: string;
  serviceId: string;
  reviewedBy?: string | null;
  inputMetrics: Record<string, unknown>;
  recommendation: {
    cpu_request_m: number;
    cpu_limit_m: number;
    memory_request_mb: number;
    memory_limit_mb: number;
    replicas: number;
    confidence: number;
    reasoning: string[];
  };
  status: RecommendationStatus;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface AuditLogDTO {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

