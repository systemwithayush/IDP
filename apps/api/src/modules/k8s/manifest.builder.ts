import type * as k8s from '@kubernetes/client-node';

export interface ManifestEnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface ManifestBuilderOptions {
  service: {
    name: string;
    imageRepo: string;
    port?: number;
  };
  environment: {
    type: string;
    k8sNamespace: string;
    replicas: number;
    cpuRequestM: number;
    memoryRequestMb: number;
    cpuLimitM?: number;
    memoryLimitMb?: number;
  };
  imageTag: string;
  variables: ManifestEnvVariable[];
  teamSlug?: string;
}

export interface K8sManifestBundle {
  namespace: k8s.V1Namespace;
  configMap: k8s.V1ConfigMap;
  secret: k8s.V1Secret;
  deployment: k8s.V1Deployment;
  service: k8s.V1Service;
}

export class ManifestBuilder {
  /**
   * Generates a fully typed Kubernetes manifest bundle without string concatenation.
   */
  public buildBundle(options: ManifestBuilderOptions): K8sManifestBundle {
    const namespace = this.buildNamespace(options);
    const configMap = this.buildConfigMap(options);
    const secret = this.buildSecret(options);
    const deployment = this.buildDeployment(options);
    const service = this.buildService(options);

    return {
      namespace,
      configMap,
      secret,
      deployment,
      service,
    };
  }

  public buildNamespace(options: ManifestBuilderOptions): k8s.V1Namespace {
    const ns: k8s.V1Namespace = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: options.environment.k8sNamespace,
        labels: {
          'app.kubernetes.io/managed-by': 'idp-platform',
          'idp.internal/service': options.service.name,
          'idp.internal/environment': options.environment.type,
          'idp.internal/team': options.teamSlug || 'default',
        },
      },
    };
    return ns;
  }

  public buildConfigMap(options: ManifestBuilderOptions): k8s.V1ConfigMap {
    const data: Record<string, string> = {};

    for (const v of options.variables) {
      if (!v.isSecret) {
        data[v.key] = v.value;
      }
    }

    // Default metadata environment variables
    data['IDP_SERVICE_NAME'] = options.service.name;
    data['IDP_ENVIRONMENT'] = options.environment.type;
    data['NODE_ENV'] = options.environment.type === 'prod' ? 'production' : options.environment.type;

    const cm: k8s.V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${options.service.name}-config`,
        namespace: options.environment.k8sNamespace,
        labels: {
          app: options.service.name,
          env: options.environment.type,
          'app.kubernetes.io/managed-by': 'idp-platform',
        },
      },
      data,
    };
    return cm;
  }

  public buildSecret(options: ManifestBuilderOptions): k8s.V1Secret {
    const stringData: Record<string, string> = {};

    for (const v of options.variables) {
      if (v.isSecret) {
        stringData[v.key] = v.value;
      }
    }

    const sec: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `${options.service.name}-secrets`,
        namespace: options.environment.k8sNamespace,
        labels: {
          app: options.service.name,
          env: options.environment.type,
          'app.kubernetes.io/managed-by': 'idp-platform',
        },
      },
      type: 'Opaque',
      stringData,
    };
    return sec;
  }

  public buildDeployment(options: ManifestBuilderOptions): k8s.V1Deployment {
    const containerPort = options.service.port || 3000;
    const fullImage = `${options.service.imageRepo}:${options.imageTag}`;

    const cpuReq = `${options.environment.cpuRequestM}m`;
    const memReq = `${options.environment.memoryRequestMb}Mi`;
    const cpuLim = `${options.environment.cpuLimitM || options.environment.cpuRequestM * 2}m`;
    const memLim = `${options.environment.memoryLimitMb || options.environment.memoryRequestMb * 2}Mi`;

    const dep: k8s.V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: options.service.name,
        namespace: options.environment.k8sNamespace,
        labels: {
          app: options.service.name,
          env: options.environment.type,
          'app.kubernetes.io/name': options.service.name,
          'app.kubernetes.io/version': options.imageTag,
          'app.kubernetes.io/managed-by': 'idp-platform',
        },
      },
      spec: {
        replicas: options.environment.replicas,
        selector: {
          matchLabels: {
            app: options.service.name,
            env: options.environment.type,
          },
        },
        template: {
          metadata: {
            labels: {
              app: options.service.name,
              env: options.environment.type,
              'app.kubernetes.io/name': options.service.name,
              'app.kubernetes.io/version': options.imageTag,
            },
          },
          spec: {
            containers: [
              {
                name: options.service.name,
                image: fullImage,
                imagePullPolicy: 'IfNotPresent',
                ports: [
                  {
                    name: 'http',
                    containerPort,
                  },
                ],
                resources: {
                  requests: {
                    cpu: cpuReq,
                    memory: memReq,
                  },
                  limits: {
                    cpu: cpuLim,
                    memory: memLim,
                  },
                },
                envFrom: [
                  {
                    configMapRef: {
                      name: `${options.service.name}-config`,
                    },
                  },
                  {
                    secretRef: {
                      name: `${options.service.name}-secrets`,
                    },
                  },
                ],
                readinessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 'http' as any,
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 10,
                },
                livenessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 'http' as any,
                  },
                  initialDelaySeconds: 15,
                  periodSeconds: 20,
                },
              },
            ],
          },
        },
      },
    };
    return dep;
  }

  public buildService(options: ManifestBuilderOptions): k8s.V1Service {
    const containerPort = options.service.port || 3000;

    const svc: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: options.service.name,
        namespace: options.environment.k8sNamespace,
        labels: {
          app: options.service.name,
          env: options.environment.type,
          'app.kubernetes.io/managed-by': 'idp-platform',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: options.service.name,
          env: options.environment.type,
        },
        ports: [
          {
            name: 'http',
            port: 80,
            targetPort: containerPort as any,
            protocol: 'TCP',
          },
        ],
      },
    };
    return svc;
  }
}

export const manifestBuilder = new ManifestBuilder();
