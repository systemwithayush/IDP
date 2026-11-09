export class KubeConfig {
  loadFromFile = jest.fn();
  loadFromDefault = jest.fn();
  makeApiClient = jest.fn((apiClass: any) => new apiClass());
}

export class CoreV1Api {
  readNamespace = jest.fn(async (_req: any) => ({}));
  createNamespace = jest.fn(async (_req: any) => ({}));
  replaceNamespacedConfigMap = jest.fn(async (_req: any) => ({}));
  createNamespacedConfigMap = jest.fn(async (_req: any) => ({}));
  replaceNamespacedSecret = jest.fn(async (_req: any) => ({}));
  createNamespacedSecret = jest.fn(async (_req: any) => ({}));
  replaceNamespacedService = jest.fn(async (_req: any) => ({}));
  createNamespacedService = jest.fn(async (_req: any) => ({}));
  listNamespacedPod = jest.fn(async (_req: any) => ({ items: [] }));
}

export class AppsV1Api {
  replaceNamespacedDeployment = jest.fn(async (_req: any) => ({}));
  createNamespacedDeployment = jest.fn(async (_req: any) => ({}));
  readNamespacedDeploymentStatus = jest.fn(async (_req: any) => ({
    spec: { replicas: 1 },
    status: { readyReplicas: 1, updatedReplicas: 1 },
  }));
}

export class Log {
  constructor(_kc?: any) {}
  log = jest.fn(async () => {});
}
